import hre from 'hardhat';
import fs from 'fs';
import path from 'path';

const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('🚀 [DEPLOY TESTNET] Deploying contracts with account:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer ETH Balance: ${ethers.formatEther(balance)} ETH`);

  // 1. Deploy MockERC20 ($RENT Token)
  console.log('\n1. Deploying MockERC20 ($RENT Token)...');
  const MockERC20Factory = await ethers.getContractFactory('MockERC20');
  const rentToken = await MockERC20Factory.deploy();
  await rentToken.waitForDeployment();
  const rentTokenAddress = await rentToken.getAddress();
  console.log('✅ MockERC20 ($RENT) deployed at:', rentTokenAddress);

  // 2. Fund deployer with test tokens
  console.log('2. Minting initial test $RENT supply to deployer...');
  const initialMintAmount = ethers.parseEther('1000000'); // 1M $RENT
  const mintTx = await rentToken.mint(deployer.address, initialMintAmount);
  await mintTx.wait();
  console.log(`✅ Minted 1,000,000 $RENT to ${deployer.address}`);

  // 3. Deploy ApiEscrow
  const backendSignerAddress = process.env.BACKEND_SIGNER_ADDRESS || deployer.address;
  console.log('\n3. Deploying ApiEscrow with backend signer:', backendSignerAddress);

  const ApiEscrowFactory = await ethers.getContractFactory('ApiEscrow');
  const apiEscrow = await ApiEscrowFactory.deploy(rentTokenAddress, backendSignerAddress);
  await apiEscrow.waitForDeployment();
  const apiEscrowAddress = await apiEscrow.getAddress();
  console.log('✅ ApiEscrow deployed at:', apiEscrowAddress);

  // 4. Export deployed contract addresses dynamically to .env.local and JSON artifact
  const envContent = `\n# --- Auto-Generated Testnet Deployment (${new Date().toISOString()}) ---
NEXT_PUBLIC_RENT_TOKEN_ADDRESS="${rentTokenAddress}"
NEXT_PUBLIC_API_ESCROW_ADDRESS="${apiEscrowAddress}"
NEXT_PUBLIC_MARKETPLACE_ADDRESS="${apiEscrowAddress}"
BACKEND_SIGNER_ADDRESS="${backendSignerAddress}"
`;

  const envPath = path.resolve(process.cwd(), '.env.local');
  try {
    fs.appendFileSync(envPath, envContent, 'utf8');
    console.log(`✅ Appended contract addresses to ${envPath}`);
  } catch (err) {
    console.warn('Could not write to .env.local, writing to deployed_contracts.json instead');
  }

  const contractsJsonPath = path.resolve(process.cwd(), 'deployed_contracts.json');
  const contractsJson = {
    network: hre.network.name,
    rentToken: rentTokenAddress,
    apiEscrow: apiEscrowAddress,
    backendSigner: backendSignerAddress,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(contractsJsonPath, JSON.stringify(contractsJson, null, 2), 'utf8');
  console.log(`✅ Deployed addresses saved to ${contractsJsonPath}`);

  console.log('\n=============================================');
  console.log('🎉 TESTNET DEPLOYMENT COMPLETE!');
  console.log(`$RENT Token: ${rentTokenAddress}`);
  console.log(`ApiEscrow:   ${apiEscrowAddress}`);
  console.log('=============================================\n');
}

main().catch((error) => {
  console.error('❌ Deployment failed:', error);
  process.exit(1);
});
