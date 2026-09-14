// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RentaAPIMarketplace
 * @notice P2P AI API Rental Escrow Marketplace with 0% platform commission
 *         and UTC daily single-lock slot mechanics.
 * @dev Deployed on Robinhood Chain (Arbitrum L2 EVM).
 */
contract RentaAPIMarketplace is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Custom Errors ---
    error ZeroAddress();
    error InvalidAmount();
    error InvalidProvider();
    error CannotRentFromSelf();
    error InvalidRentalDate();
    error SlotAlreadyRented(bytes32 slotId, uint256 rentalDate);
    error RentalNotFound();
    error RentalNotActive();
    error UnauthorizedCaller();
    error AutoReleaseTimeoutNotReached(uint256 availableAt, uint256 currentTimestamp);

    // --- Enums & Structs ---
    enum RentalStatus {
        Active,
        Released,
        Refunded
    }

    struct RentalAgreement {
        bytes32 slotId;
        uint256 rentalDate; // YYYYMMDD as uint (e.g. 20260912) or unix timestamp
        address renter;
        address provider;
        uint256 amount;
        RentalStatus status;
        uint256 createdAt;
    }

    // --- State Variables ---
    IERC20 public immutable rentToken;

    /// @notice Minimum duration after creation before a provider can trigger auto-release (default: 24 hours)
    uint256 public constant AUTO_RELEASE_DELAY = 24 hours;

    /// @notice slotId => rentalDate => isLocked
    mapping(bytes32 => mapping(uint256 => bool)) public isSlotDateLocked;

    /// @notice rentalId => RentalAgreement
    mapping(bytes32 => RentalAgreement) public rentals;

    // --- Events ---
    event Rented(
        bytes32 indexed rentalId,
        bytes32 indexed slotId,
        uint256 indexed rentalDate,
        address renter,
        address provider,
        uint256 amount
    );

    event Released(
        bytes32 indexed rentalId,
        address indexed provider,
        uint256 amount,
        address releasedBy
    );

    event Refunded(
        bytes32 indexed rentalId,
        address indexed renter,
        uint256 amount,
        address refundedBy
    );

    constructor(address _rentToken, address initialOwner) Ownable(initialOwner) {
        if (_rentToken == address(0) || initialOwner == address(0)) {
            revert ZeroAddress();
        }
        rentToken = IERC20(_rentToken);
    }

    /**
     * @notice Rents an AI API slot for a specific UTC date.
     * @dev Locks $RENT tokens in escrow (0% fee retained by contract).
     * @param slotId The unique hash identifier of the provider's slot.
     * @param rentalDate The integer representation of the rental date (e.g., YYYYMMDD).
     * @param tokenAmount The amount of RENT tokens to escrow.
     * @param provider The wallet address of the key owner receiving payment.
     * @return rentalId The unique bytes32 hash of this rental agreement.
     */
    function rent(
        bytes32 slotId,
        uint256 rentalDate,
        uint256 tokenAmount,
        address provider
    ) external whenNotPaused nonReentrant returns (bytes32 rentalId) {
        if (tokenAmount == 0) revert InvalidAmount();
        if (provider == address(0)) revert InvalidProvider();
        if (provider == msg.sender) revert CannotRentFromSelf();

        uint256 todayUtcStart = (block.timestamp / 1 days) * 1 days;
        uint256 tomorrowUtcStart = todayUtcStart + 1 days;
        if (rentalDate < todayUtcStart || rentalDate > tomorrowUtcStart) {
            revert InvalidRentalDate();
        }

        uint256 normalizedDate = (rentalDate / 1 days) * 1 days;
        if (isSlotDateLocked[slotId][normalizedDate]) {
            revert SlotAlreadyRented(slotId, normalizedDate);
        }

        rentalId = keccak256(
            abi.encodePacked(slotId, normalizedDate, msg.sender, block.timestamp)
        );

        // Check effects
        isSlotDateLocked[slotId][normalizedDate] = true;
        rentals[rentalId] = RentalAgreement({
            slotId: slotId,
            rentalDate: normalizedDate,
            renter: msg.sender,
            provider: provider,
            amount: tokenAmount,
            status: RentalStatus.Active,
            createdAt: block.timestamp
        });

        // Interaction: pull RENT tokens into escrow
        rentToken.safeTransferFrom(msg.sender, address(this), tokenAmount);

        emit Rented(rentalId, slotId, normalizedDate, msg.sender, provider, tokenAmount);
    }

    /**
     * @notice Releases 100% of escrowed funds to the provider.
     * @dev Zero commission is deducted. 100% goes directly to provider.
     *      Can be called by renter at any time, or provider after AUTO_RELEASE_DELAY, or contract owner.
     * @param rentalId The unique ID of the rental.
     */
    function release(bytes32 rentalId) external nonReentrant {
        RentalAgreement storage agreement = rentals[rentalId];
        if (agreement.amount == 0) revert RentalNotFound();
        if (agreement.status != RentalStatus.Active) revert RentalNotActive();

        bool isRenter = (msg.sender == agreement.renter);
        bool isOwnerCaller = (msg.sender == owner());
        bool isProvider = (msg.sender == agreement.provider);
        bool isProviderTimeout = (isProvider && block.timestamp >= agreement.createdAt + AUTO_RELEASE_DELAY);

        if (!isRenter && !isOwnerCaller && !isProviderTimeout) {
            if (isProvider) {
                revert AutoReleaseTimeoutNotReached(
                    agreement.createdAt + AUTO_RELEASE_DELAY,
                    block.timestamp
                );
            }
            revert UnauthorizedCaller();
        }

        agreement.status = RentalStatus.Released;
        uint256 payoutAmount = agreement.amount;

        // 100% transferred to provider (0% commission)
        rentToken.safeTransfer(agreement.provider, payoutAmount);

        emit Released(rentalId, agreement.provider, payoutAmount, msg.sender);
    }

    /**
     * @notice Refunds escrowed tokens back to the renter.
     * @dev Can be called by provider (voluntary refund) or platform owner (in case of validated disputes).
     * @param rentalId The unique ID of the rental.
     */
    function refund(bytes32 rentalId) external nonReentrant {
        RentalAgreement storage agreement = rentals[rentalId];
        if (agreement.amount == 0) revert RentalNotFound();
        if (agreement.status != RentalStatus.Active) revert RentalNotActive();

        bool isProvider = (msg.sender == agreement.provider);
        bool isOwnerCaller = (msg.sender == owner());

        if (!isProvider && !isOwnerCaller) {
            revert UnauthorizedCaller();
        }

        agreement.status = RentalStatus.Refunded;
        uint256 refundAmount = agreement.amount;

        // Unlock slot date lock so it could theoretically be re-rented or cleared
        isSlotDateLocked[agreement.slotId][agreement.rentalDate] = false;

        // 100% returned to renter
        rentToken.safeTransfer(agreement.renter, refundAmount);

        emit Refunded(rentalId, agreement.renter, refundAmount, msg.sender);
    }

    /**
     * @notice Pauses contract in emergencies.
     */
    function emergencyPause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resumes contract after emergency resolution.
     */
    function emergencyUnpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice View function to inspect rental details.
     */
    function getRental(bytes32 rentalId) external view returns (RentalAgreement memory) {
        RentalAgreement memory agreement = rentals[rentalId];
        if (agreement.amount == 0) revert RentalNotFound();
        return agreement;
    }
}
