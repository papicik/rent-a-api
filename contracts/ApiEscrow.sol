// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ApiEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable rentToken;
    address public backendSigner;

    enum RentalStatus { ACTIVE, RELEASED, REFUNDED }

    struct Rental {
        uint256 id;
        string slotId;
        address renter;
        address provider;
        uint256 amount;
        uint256 startTime;
        uint256 duration;
        RentalStatus status;
    }

    uint256 public rentalCounter;
    mapping(uint256 => Rental) public rentals;
    mapping(string => uint256) public activeSlotRental;

    event RentalCreated(
        uint256 indexed rentalId,
        string slotId,
        address indexed renter,
        address indexed provider,
        uint256 amount,
        uint256 startTime,
        uint256 duration
    );
    event FundsReleased(uint256 indexed rentalId, address indexed provider, uint256 amount);
    event FundsRefunded(uint256 indexed rentalId, address indexed renter, uint256 amount);
    event SignerUpdated(address newSigner);

    modifier onlySignerOrOwner() {
        require(msg.sender == backendSigner || msg.sender == owner(), "Unauthorized");
        _;
    }

    constructor(address _rentToken, address _backendSigner) Ownable(msg.sender) {
        require(_rentToken != address(0), "Invalid token address");
        require(_backendSigner != address(0), "Invalid signer address");
        rentToken = IERC20(_rentToken);
        backendSigner = _backendSigner;
    }

    function setBackendSigner(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "Invalid address");
        backendSigner = _newSigner;
        emit SignerUpdated(_newSigner);
    }

    function createRental(
        string calldata slotId,
        address provider,
        uint256 amount,
        uint256 duration
    ) external nonReentrant returns (uint256) {
        require(provider != address(0), "Invalid provider");
        require(amount > 0, "Amount must be > 0");
        require(duration > 0, "Duration must be > 0");

        uint256 currentActiveId = activeSlotRental[slotId];
        if (currentActiveId != 0) {
            Rental memory prev = rentals[currentActiveId];
            if (prev.status == RentalStatus.ACTIVE && block.timestamp < prev.startTime + prev.duration) {
                revert("Slot currently locked in active rental");
            }
        }

        rentToken.safeTransferFrom(msg.sender, address(this), amount);

        rentalCounter++;
        uint256 newRentalId = rentalCounter;

        rentals[newRentalId] = Rental({
            id: newRentalId,
            slotId: slotId,
            renter: msg.sender,
            provider: provider,
            amount: amount,
            startTime: block.timestamp,
            duration: duration,
            status: RentalStatus.ACTIVE
        });

        activeSlotRental[slotId] = newRentalId;

        emit RentalCreated(newRentalId, slotId, msg.sender, provider, amount, block.timestamp, duration);
        return newRentalId;
    }

    function releaseFunds(uint256 rentalId) external nonReentrant {
        Rental storage rental = rentals[rentalId];
        require(rental.status == RentalStatus.ACTIVE, "Rental not active");
        
        bool isExpired = block.timestamp >= rental.startTime + rental.duration;
        bool isAuthorized = (msg.sender == backendSigner || msg.sender == owner() || (msg.sender == rental.provider && isExpired));
        require(isAuthorized, "Unauthorized to release");

        rental.status = RentalStatus.RELEASED;
        rentToken.safeTransfer(rental.provider, rental.amount);

        emit FundsReleased(rentalId, rental.provider, rental.amount);
    }

    function refundRental(uint256 rentalId) external onlySignerOrOwner nonReentrant {
        Rental storage rental = rentals[rentalId];
        require(rental.status == RentalStatus.ACTIVE, "Rental not active");

        rental.status = RentalStatus.REFUNDED;
        rentToken.safeTransfer(rental.renter, rental.amount);

        emit FundsRefunded(rentalId, rental.renter, rental.amount);
    }
}
