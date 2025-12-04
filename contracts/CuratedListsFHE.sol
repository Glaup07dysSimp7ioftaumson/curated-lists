// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract CuratedListsFHE is SepoliaConfig {
    // state
    uint256 public listCount;
    address public treasury;

    // structs
    struct EncryptedList {
        uint256 id;
        address creator;
        euint32 encryptedTitle;
        euint32 encryptedItems; // pointer to encrypted list data
        uint256 createdAt;
    }

    struct TallyRequest {
        uint256 listId;
        address requester;
    }

    // mappings
    mapping(uint256 => EncryptedList) public encryptedLists;
    mapping(uint256 => euint32) private encryptedVoteCounts; // encrypted tallies per list
    mapping(uint256 => uint256) private requestToListId;
    mapping(address => mapping(uint256 => uint256)) public stakes; // staker => listId => amount
    mapping(address => uint256) public rewards;

    // events
    event EncryptedListCreated(uint256 indexed id);
    event VotedWithStake(address indexed voter, uint256 indexed listId, uint256 stake);
    event TallyRequested(uint256 indexed listId, uint256 requestId);
    event TallyDecrypted(uint256 indexed listId, uint256 decryptedCount);
    event RewardClaimed(address indexed who, uint256 amount);

    // modifiers
    modifier nonZero() {
        require(msg.value > 0, "zero");
        _;
    }

    /// @notice Create an encrypted curated list
    function createEncryptedList(
        euint32 encryptedTitle,
        euint32 encryptedItems
    ) public {
        listCount += 1;
        uint256 newId = listCount;

        encryptedLists[newId] = EncryptedList({
            id: newId,
            creator: msg.sender,
            encryptedTitle: encryptedTitle,
            encryptedItems: encryptedItems,
            createdAt: block.timestamp
        });

        // initialize encrypted tally if needed
        if (!FHE.isInitialized(encryptedVoteCounts[newId])) {
            encryptedVoteCounts[newId] = FHE.asEuint32(0);
        }

        emit EncryptedListCreated(newId);
    }

    /// @notice Stake and cast an encrypted vote
    function stakeAndVote(uint256 listId, euint32 encryptedVote) public payable nonZero {
        require(listId > 0 && listId <= listCount, "invalid");
        // accept stake
        stakes[msg.sender][listId] += msg.value;

        // combine encrypted votes (homomorphic add)
        if (!FHE.isInitialized(encryptedVoteCounts[listId])) {
            encryptedVoteCounts[listId] = encryptedVote;
        } else {
            encryptedVoteCounts[listId] = FHE.add(encryptedVoteCounts[listId], encryptedVote);
        }

        emit VotedWithStake(msg.sender, listId, msg.value);
    }

    /// @notice Request decryption of tally for a list
    function requestTallyDecryption(uint256 listId) public {
        require(listId > 0 && listId <= listCount, "invalid");
        euint32 tally = encryptedVoteCounts[listId];
        require(FHE.isInitialized(tally), "notinit");

        bytes32[] memory ciphertexts = new bytes32[](1);
        ciphertexts[0] = FHE.toBytes32(tally);

        uint256 reqId = FHE.requestDecryption(ciphertexts, this.onTallyDecrypted.selector);
        requestToListId[reqId] = listId;

        emit TallyRequested(listId, reqId);
    }

    /// @notice Callback invoked by FHE decryption service
    function onTallyDecrypted(uint256 requestId, bytes memory cleartexts, bytes memory proof) public {
        uint256 listId = requestToListId[requestId];
        require(listId != 0, "badreq");

        // verify proof
        FHE.checkSignatures(requestId, cleartexts, proof);

        // decode cleartext
        uint32 count = abi.decode(cleartexts, (uint32));

        // distribute simple rewards: creator gets 10%, treasury 10%, voters share 80% proportionally to stake
        uint256 totalReward = address(this).balance;
        if (totalReward > 0) {
            uint256 creatorShare = (totalReward * 10) / 100;
            uint256 treasuryShare = (totalReward * 10) / 100;
            uint256 votersShare = totalReward - creatorShare - treasuryShare;

            rewards[encryptedLists[listId].creator] += creatorShare;
            rewards[treasury] += treasuryShare;

            // naive distribution: every staker who staked on this list gets proportional share
            // iterate over expected stakers is not feasible on-chain; simplified: place votersShare into a pool claimable by anyone who staked (manual off-chain accounting expected)
            rewards[address(this)] += votersShare;
        }

        emit TallyDecrypted(listId, count);
    }

    /// @notice Claim accumulated rewards
    function claimRewards() public {
        uint256 amount = rewards[msg.sender];
        require(amount > 0, "no");
        rewards[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        emit RewardClaimed(msg.sender, amount);
    }

    /// @notice Withdraw stake for a list
    function withdrawStake(uint256 listId) public {
        uint256 amount = stakes[msg.sender][listId];
        require(amount > 0, "nostake");
        stakes[msg.sender][listId] = 0;
        payable(msg.sender).transfer(amount);
    }

    /// @notice Set treasury address
    function setTreasury(address _treasury) public {
        // placeholder access control
        treasury = _treasury;
    }

    // helper: view encrypted tally
    function getEncryptedTally(uint256 listId) public view returns (euint32) {
        return encryptedVoteCounts[listId];
    }

    // helper: get list metadata
    function getList(uint256 listId) public view returns (
        uint256 id,
        address creator,
        euint32 encryptedTitle,
        euint32 encryptedItems,
        uint256 createdAt
    ) {
        EncryptedList storage l = encryptedLists[listId];
        return (l.id, l.creator, l.encryptedTitle, l.encryptedItems, l.createdAt);
    }
}
