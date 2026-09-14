import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ApiEscrow, MockRentToken } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("ApiEscrow Smart Contract Suite", function () {
  let escrow: ApiEscrow;
  let rentToken: MockRentToken;
  let owner: HardhatEthersSigner;
  let backendSigner: HardhatEthersSigner;
  let renter: HardhatEthersSigner;
  let provider: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;

  const SLOT_ID = "slot-claude-sonnet-4";
  const RENTAL_AMOUNT = ethers.parseEther("210"); // 210 RENT
  const DURATION = 24 * 3600; // 24 hours

  beforeEach(async function () {
    [owner, backendSigner, renter, provider, attacker] = await ethers.getSigners();

    // Deploy Mock ERC-20 RENT token
    const MockRentTokenFactory = await ethers.getContractFactory("MockRentToken");
    rentToken = await MockRentTokenFactory.deploy();
    await rentToken.waitForDeployment();

    // Deploy ApiEscrow
    const ApiEscrowFactory = await ethers.getContractFactory("ApiEscrow");
    escrow = await ApiEscrowFactory.deploy(
      await rentToken.getAddress(),
      backendSigner.address
    );
    await escrow.waitForDeployment();

    // Mint tokens to renter and approve escrow contract
    await rentToken.mint(renter.address, ethers.parseEther("1000"));
    await rentToken
      .connect(renter)
      .approve(await escrow.getAddress(), ethers.MaxUint256);
  });

  describe("1. Rental Creation & Slot Locking", function () {
    it("should successfully lock funds and emit RentalCreated event", async function () {
      const escrowAddress = await escrow.getAddress();
      const initialRenterBalance = await rentToken.balanceOf(renter.address);

      const tx = await escrow
        .connect(renter)
        .createRental(SLOT_ID, provider.address, RENTAL_AMOUNT, DURATION);
      const receipt = await tx.wait();

      expect(receipt).to.not.be.null;

      // Check balances
      expect(await rentToken.balanceOf(escrowAddress)).to.equal(RENTAL_AMOUNT);
      expect(await rentToken.balanceOf(renter.address)).to.equal(initialRenterBalance - RENTAL_AMOUNT);

      // Check contract state
      const rentalId = await escrow.rentalCounter();
      expect(rentalId).to.equal(1n);

      const rental = await escrow.rentals(rentalId);
      expect(rental.slotId).to.equal(SLOT_ID);
      expect(rental.renter).to.equal(renter.address);
      expect(rental.provider).to.equal(provider.address);
      expect(rental.amount).to.equal(RENTAL_AMOUNT);
      expect(rental.status).to.equal(0); // ACTIVE

      const activeId = await escrow.activeSlotRental(SLOT_ID);
      expect(activeId).to.equal(rentalId);
    });

    it("should prevent duplicate rentals on active slot before expiry", async function () {
      await escrow
        .connect(renter)
        .createRental(SLOT_ID, provider.address, RENTAL_AMOUNT, DURATION);

      // Second attempt by attacker while active
      await rentToken.mint(attacker.address, ethers.parseEther("500"));
      await rentToken.connect(attacker).approve(await escrow.getAddress(), ethers.MaxUint256);

      await expect(
        escrow.connect(attacker).createRental(SLOT_ID, provider.address, RENTAL_AMOUNT, DURATION)
      ).to.be.revertedWith("Slot currently locked in active rental");
    });

    it("should allow re-renting the slot once duration has expired", async function () {
      await escrow
        .connect(renter)
        .createRental(SLOT_ID, provider.address, RENTAL_AMOUNT, DURATION);

      // Advance time beyond duration
      await time.increase(DURATION + 1);

      // Another user can now rent the slot
      await rentToken.mint(attacker.address, ethers.parseEther("500"));
      await rentToken.connect(attacker).approve(await escrow.getAddress(), ethers.MaxUint256);

      await expect(
        escrow.connect(attacker).createRental(SLOT_ID, provider.address, RENTAL_AMOUNT, DURATION)
      ).to.not.be.reverted;
    });
  });

  describe("2. Release Funds", function () {
    let rentalId: bigint;

    beforeEach(async function () {
      const tx = await escrow
        .connect(renter)
        .createRental(SLOT_ID, provider.address, RENTAL_AMOUNT, DURATION);
      await tx.wait();
      rentalId = await escrow.rentalCounter();
    });

    it("backendSigner can release funds to provider", async function () {
      const initialProviderBalance = await rentToken.balanceOf(provider.address);

      await expect(escrow.connect(backendSigner).releaseFunds(rentalId))
        .to.emit(escrow, "FundsReleased")
        .withArgs(rentalId, provider.address, RENTAL_AMOUNT);

      const finalProviderBalance = await rentToken.balanceOf(provider.address);
      expect(finalProviderBalance - initialProviderBalance).to.equal(RENTAL_AMOUNT);

      const rental = await escrow.rentals(rentalId);
      expect(rental.status).to.equal(1); // RELEASED
    });

    it("provider cannot release prematurely before expiry, but can release after", async function () {
      await expect(
        escrow.connect(provider).releaseFunds(rentalId)
      ).to.be.revertedWith("Unauthorized to release");

      // Advance time past expiry
      await time.increase(DURATION + 1);

      await expect(escrow.connect(provider).releaseFunds(rentalId))
        .to.emit(escrow, "FundsReleased")
        .withArgs(rentalId, provider.address, RENTAL_AMOUNT);
    });
  });

  describe("3. Refund Rental", function () {
    let rentalId: bigint;

    beforeEach(async function () {
      const tx = await escrow
        .connect(renter)
        .createRental(SLOT_ID, provider.address, RENTAL_AMOUNT, DURATION);
      await tx.wait();
      rentalId = await escrow.rentalCounter();
    });

    it("backendSigner or owner can refund funds back to renter", async function () {
      const initialRenterBalance = await rentToken.balanceOf(renter.address);

      await expect(escrow.connect(backendSigner).refundRental(rentalId))
        .to.emit(escrow, "FundsRefunded")
        .withArgs(rentalId, renter.address, RENTAL_AMOUNT);

      const finalRenterBalance = await rentToken.balanceOf(renter.address);
      expect(finalRenterBalance - initialRenterBalance).to.equal(RENTAL_AMOUNT);

      const rental = await escrow.rentals(rentalId);
      expect(rental.status).to.equal(2); // REFUNDED
    });

    it("unauthorized caller cannot execute refund", async function () {
      await expect(
        escrow.connect(attacker).refundRental(rentalId)
      ).to.be.revertedWith("Unauthorized");
    });
  });

  describe("4. Admin Controls", function () {
    it("owner can update backend signer", async function () {
      await expect(escrow.connect(owner).setBackendSigner(attacker.address))
        .to.emit(escrow, "SignerUpdated")
        .withArgs(attacker.address);

      expect(await escrow.backendSigner()).to.equal(attacker.address);
    });
  });
});
