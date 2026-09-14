import hre from "hardhat";
const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // 1. Deploy MockERC20 ($RENT Token)
  console.log("Deploying MockERC20 ($RENT)...");
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  const rentToken = await MockERC20Factory.deploy();
  await rentToken.waitForDeployment();
  const rentTokenAddress = await rentToken.getAddress();
  console.log("MockERC20 ($RENT) deployed to:", rentTokenAddress);

  // 2. Deploy ApiEscrow
  const backendSignerAddress = process.env.BACKEND_SIGNER_ADDRESS || deployer.address;
  console.log("Deploying ApiEscrow with backendSigner:", backendSignerAddress);

  const ApiEscrowFactory = await ethers.getContractFactory("ApiEscrow");
  const apiEscrow = await ApiEscrowFactory.deploy(rentTokenAddress, backendSignerAddress);
  await apiEscrow.waitForDeployment();
  const apiEscrowAddress = await apiEscrow.getAddress();
  console.log("ApiEscrow deployed to:", apiEscrowAddress);

  console.log("\nDeployment Summary:");
  console.log("-------------------");
  console.log(`NEXT_PUBLIC_RENT_TOKEN_ADDRESS="${rentTokenAddress}"`);
  console.log(`NEXT_PUBLIC_API_ESCROW_ADDRESS="${apiEscrowAddress}"`);
  console.log(`BACKEND_SIGNER_ADDRESS="${backendSignerAddress}"`);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exit(1);
});
