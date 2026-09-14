import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { RentaAPIMarketplace, MockRentToken } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("RentaAPIMarketplace Smart Contract Suite", function () {
  let marketplace: RentaAPIMarketplace;
  let rentToken: MockRentToken;
  let owner: HardhatEthersSigner;
  let renter: HardhatEthersSigner;
  let provider: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;

  const SLOT_ID_1 = ethers.keccak256(ethers.toUtf8Bytes("slot-claude-35-sonnet"));
  let RENTAL_DATE_TODAY: bigint;
  let RENTAL_DATE_TOMORROW: bigint;
  const RENTAL_AMOUNT = ethers.parseEther("100"); // 100 RENT

  beforeEach(async function () {
    [owner, renter, provider, attacker] = await ethers.getSigners();

    const currentTimestamp = await time.latest();
    RENTAL_DATE_TODAY = BigInt(Math.floor(currentTimestamp / 86400) * 86400);
    RENTAL_DATE_TOMORROW = RENTAL_DATE_TODAY + 86400n;

    // Deploy MockRentToken
    const MockRentTokenFactory = await ethers.getContractFactory("MockRentToken");
    rentToken = await MockRentTokenFactory.deploy();
    await rentToken.waitForDeployment();

    // Deploy RentaAPIMarketplace
    const MarketplaceFactory = await ethers.getContractFactory("RentaAPIMarketplace");
    marketplace = await MarketplaceFactory.deploy(
      await rentToken.getAddress(),
      owner.address
    );
    await marketplace.waitForDeployment();

    // Fund renter with RENT and approve marketplace
    await rentToken.mint(renter.address, ethers.parseEther("1000"));
    await rentToken
      .connect(renter)
      .approve(await marketplace.getAddress(), ethers.MaxUint256);
  });

  describe("1. Rental Creation & Escrow Lock", function () {
    it("should successfully lock $RENT tokens into escrow for a UTC date", async function () {
      const marketplaceAddress = await marketplace.getAddress();
      const initialRenterBalance = await rentToken.balanceOf(renter.address);

      const tx = await marketplace
        .connect(renter)
        .rent(SLOT_ID_1, RENTAL_DATE_TODAY, RENTAL_AMOUNT, provider.address);

      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;

      // Check Renter balance reduced by RENTAL_AMOUNT
      const newRenterBalance = await rentToken.balanceOf(renter.address);
      expect(initialRenterBalance - newRenterBalance).to.equal(RENTAL_AMOUNT);

      // Check Escrow contract balance has RENTAL_AMOUNT
      const escrowBalance = await rentToken.balanceOf(marketplaceAddress);
      expect(escrowBalance).to.equal(RENTAL_AMOUNT);

      // Verify slot is locked for this date
      const isLocked = await marketplace.isSlotDateLocked(SLOT_ID_1, RENTAL_DATE_TODAY);
      expect(isLocked).to.be.true;
    });

    it("should reject renting with 0 amount or to self", async function () {
      await expect(
        marketplace.connect(renter).rent(SLOT_ID_1, RENTAL_DATE_TODAY, 0, provider.address)
      ).to.be.revertedWithCustomError(marketplace, "InvalidAmount");

      await expect(
        marketplace.connect(renter).rent(SLOT_ID_1, RENTAL_DATE_TODAY, RENTAL_AMOUNT, renter.address)
      ).to.be.revertedWithCustomError(marketplace, "CannotRentFromSelf");
    });

    it("should revert if rentalDate is in the year 2099", async function () {
      const year2099Timestamp = BigInt(Math.floor(new Date("2099-01-01T00:00:00Z").getTime() / 1000));
      await expect(
        marketplace.connect(renter).rent(SLOT_ID_1, year2099Timestamp, RENTAL_AMOUNT, provider.address)
      ).to.be.revertedWithCustomError(marketplace, "InvalidRentalDate");

      await expect(
        marketplace.connect(renter).rent(SLOT_ID_1, 2099n, RENTAL_AMOUNT, provider.address)
      ).to.be.revertedWithCustomError(marketplace, "InvalidRentalDate");
    });
  });

  describe("2. 100% Provider Release (0% Platform Fee Enforced)", function () {
    it("should transfer 100% of escrowed RENT to provider with 0 fee retained", async function () {
      const marketplaceAddress = await marketplace.getAddress();
      const initialProviderBalance = await rentToken.balanceOf(provider.address);

      const tx = await marketplace
        .connect(renter)
        .rent(SLOT_ID_1, RENTAL_DATE_TODAY, RENTAL_AMOUNT, provider.address);
      const receipt = await tx.wait();

      // Find Rented event
      const rentedEvent = receipt?.logs
        .map((log) => {
          try {
            return marketplace.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed) => parsed?.name === "Rented");

      expect(rentedEvent).to.not.be.undefined;
      const rentalId = rentedEvent?.args.rentalId;

      // Renter releases escrow
      await expect(marketplace.connect(renter).release(rentalId))
        .to.emit(marketplace, "Released")
        .withArgs(rentalId, provider.address, RENTAL_AMOUNT, renter.address);

      // Provider received EXACTLY 100% of the RENTAL_AMOUNT (0% fee)
      const finalProviderBalance = await rentToken.balanceOf(provider.address);
      expect(finalProviderBalance - initialProviderBalance).to.equal(RENTAL_AMOUNT);

      // Contract balance is now 0 (no platform fee withheld)
      const escrowBalance = await rentToken.balanceOf(marketplaceAddress);
      expect(escrowBalance).to.equal(0n);

      // Rental status is Released
      const rental = await marketplace.getRental(rentalId);
      expect(rental.status).to.equal(1); // RentalStatus.Released
    });

    it("provider cannot release prematurely before 24h timeout, but can release after", async function () {
      const tx = await marketplace
        .connect(renter)
        .rent(SLOT_ID_1, RENTAL_DATE_TODAY, RENTAL_AMOUNT, provider.address);
      const receipt = await tx.wait();
      const rentedEvent = receipt?.logs
        .map((log) => {
          try {
            return marketplace.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed) => parsed?.name === "Rented");
      const rentalId = rentedEvent?.args.rentalId;

      // Attempt by provider immediately should fail with AutoReleaseTimeoutNotReached
      await expect(
        marketplace.connect(provider).release(rentalId)
      ).to.be.revertedWithCustomError(marketplace, "AutoReleaseTimeoutNotReached");

      // Advance time by 24 hours + 1 second
      await time.increase(24 * 3600 + 1);

      // Now provider can trigger auto-release
      await expect(marketplace.connect(provider).release(rentalId))
        .to.emit(marketplace, "Released")
        .withArgs(rentalId, provider.address, RENTAL_AMOUNT, provider.address);

      const finalProviderBalance = await rentToken.balanceOf(provider.address);
      expect(finalProviderBalance).to.equal(RENTAL_AMOUNT);
    });
  });

  describe("3. Refund Scenario", function () {
    it("should refund 100% of RENT back to renter if provider or owner approves", async function () {
      const initialRenterBalance = await rentToken.balanceOf(renter.address);

      const tx = await marketplace
        .connect(renter)
        .rent(SLOT_ID_1, RENTAL_DATE_TODAY, RENTAL_AMOUNT, provider.address);
      const receipt = await tx.wait();
      const rentedEvent = receipt?.logs
        .map((log) => {
          try {
            return marketplace.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed) => parsed?.name === "Rented");
      const rentalId = rentedEvent?.args.rentalId;

      // Provider issues refund
      await expect(marketplace.connect(provider).refund(rentalId))
        .to.emit(marketplace, "Refunded")
        .withArgs(rentalId, renter.address, RENTAL_AMOUNT, provider.address);

      // Renter balance is restored to 100%
      const finalRenterBalance = await rentToken.balanceOf(renter.address);
      expect(finalRenterBalance).to.equal(initialRenterBalance);

      // Date lock is freed
      const isLocked = await marketplace.isSlotDateLocked(SLOT_ID_1, RENTAL_DATE_TODAY);
      expect(isLocked).to.be.false;

      // Rental status is Refunded
      const rental = await marketplace.getRental(rentalId);
      expect(rental.status).to.equal(2); // RentalStatus.Refunded
    });
  });

  describe("4. Collision Protection (Same Slot + Same UTC Date)", function () {
    it("should revert if another renter attempts to rent the same slot on the same UTC date", async function () {
      // First rent succeeds
      await marketplace
        .connect(renter)
        .rent(SLOT_ID_1, RENTAL_DATE_TODAY, RENTAL_AMOUNT, provider.address);

      // Give attacker tokens and approval
      await rentToken.mint(attacker.address, ethers.parseEther("500"));
      await rentToken
        .connect(attacker)
        .approve(await marketplace.getAddress(), ethers.MaxUint256);

      // Second attempt on same slot and same date MUST revert with SlotAlreadyRented
      await expect(
        marketplace
          .connect(attacker)
          .rent(SLOT_ID_1, RENTAL_DATE_TODAY, RENTAL_AMOUNT, provider.address)
      ).to.be.revertedWithCustomError(marketplace, "SlotAlreadyRented")
        .withArgs(SLOT_ID_1, RENTAL_DATE_TODAY);
    });

    it("should allow renting the same slot for a DIFFERENT UTC date", async function () {
      await marketplace
        .connect(renter)
        .rent(SLOT_ID_1, RENTAL_DATE_TODAY, RENTAL_AMOUNT, provider.address);

      await expect(
        marketplace
          .connect(renter)
          .rent(SLOT_ID_1, RENTAL_DATE_TOMORROW, RENTAL_AMOUNT, provider.address)
      ).to.not.be.reverted;
    });
  });

  describe("5. Emergency Pause / Unpause", function () {
    it("should block new rentals when contract is paused and resume when unpaused", async function () {
      // Non-owner cannot pause
      await expect(marketplace.connect(attacker).emergencyPause()).to.be.revertedWithCustomError(
        marketplace,
        "OwnableUnauthorizedAccount"
      );

      // Owner pauses
      await marketplace.connect(owner).emergencyPause();

      // Rental fails with EnforcedPause
      await expect(
        marketplace
          .connect(renter)
          .rent(SLOT_ID_1, RENTAL_DATE_TODAY, RENTAL_AMOUNT, provider.address)
      ).to.be.revertedWithCustomError(marketplace, "EnforcedPause");

      // Owner unpauses
      await marketplace.connect(owner).emergencyUnpause();

      // Now rental succeeds
      await expect(
        marketplace
          .connect(renter)
          .rent(SLOT_ID_1, RENTAL_DATE_TODAY, RENTAL_AMOUNT, provider.address)
      ).to.not.be.reverted;
    });
  });

  describe("6. Unauthorized Access Control & Reentrancy Guards", function () {
    it("should revert if an unauthorized third-party attempts to release or refund", async function () {
      const tx = await marketplace
        .connect(renter)
        .rent(SLOT_ID_1, RENTAL_DATE_TODAY, RENTAL_AMOUNT, provider.address);
      const receipt = await tx.wait();
      const rentedEvent = receipt?.logs
        .map((log) => {
          try {
            return marketplace.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed) => parsed?.name === "Rented");
      const rentalId = rentedEvent?.args.rentalId;

      // Attacker tries to release
      await expect(
        marketplace.connect(attacker).release(rentalId)
      ).to.be.revertedWithCustomError(marketplace, "UnauthorizedCaller");

      // Attacker tries to refund
      await expect(
        marketplace.connect(attacker).refund(rentalId)
      ).to.be.revertedWithCustomError(marketplace, "UnauthorizedCaller");
    });
  });
});
