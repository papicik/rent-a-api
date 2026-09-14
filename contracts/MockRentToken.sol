// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockRentToken
 * @notice Mock $RENT ERC-20 token for testing the RENT-A-API marketplace.
 */
contract MockRentToken is ERC20 {
    constructor() ERC20("Rent-A-API Token", "RENT") {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
