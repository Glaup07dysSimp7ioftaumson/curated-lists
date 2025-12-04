# CuratedLists (Privacy-Preserving)

A privacy-first, decentralized content curation platform enabling users to create and support curated lists (for example, *Top 10 Sci‑Fi Movies*) while keeping who voted for which list confidential. Votes and computations use encryption and privacy-preserving techniques so rankings are verifiable without revealing individual preferences.

## Overview

CuratedLists lets community members publish themed lists and anonymously support them. The system stores lists and encrypted votes on-chain, aggregates results with privacy-preserving computation, and distributes incentives to curators and participants. The platform is designed for transparency, immutability, and strong privacy guarantees.

## Project Background

Content ranking and curation on centralized platforms face several issues:

- **Privacy risks**: Voting and preference data may be tied to individual users.
- **Centralized control**: Platforms can censor, tamper with, or reorder results.
- **Lack of verifiability**: Users cannot independently verify that votes were counted honestly.
- **Weak incentives**: Curators and voters often receive little or no reward for contributing quality content.

CuratedLists addresses these problems by combining smart contracts, client-side encryption, and privacy-preserving computation so that results are auditable while individual votes remain confidential.

## Key Features

### Core Functionality
- **List Creation**: Users can publish curated lists with metadata (title, description, items, tags).
- **Anonymous Voting**: Support a list by submitting an encrypted vote; votes are unlinkable to voter identities.
- **Encrypted Tallying**: Vote aggregation uses privacy-preserving techniques so tallies can be computed without revealing individual ballots.
- **Public Rankings**: Aggregated results and ranked lists are publicly visible and auditable.
- **Incentives**: Tokenized rewards for curators and voters based on participation and stake.

### Privacy & Security
- **Client-side Encryption**: Votes and sensitive payloads are encrypted in the browser before submission.
- **Anonymity by Design**: No personal identifiers are stored with votes; wallet addresses are not linked to vote contents.
- **Immutable Ledger**: Lists and encrypted votes are stored immutably on-chain.
- **Auditable Outcomes**: Aggregation and ranking results are verifiable on-chain while preserving vote confidentiality.

## Architecture

### Smart Contracts
- **CuratedLists.sol** (deployed on an fhEVM-compatible network)
  - Manages list lifecycle (create, update metadata, close).
  - Receives and stores encrypted ballots.
  - Records staking and reward distribution rules.
  - Publishes aggregation-ready data used by the tallying service.

### Off-chain / Privacy-Preserving Components
- **Client**: Handles list creation UI, client-side encryption, vote submission, and signature handling.
- **Tally Service**: Performs privacy-preserving aggregation (e.g., FHE-compatible processing), publishes aggregated results and proofs.
- **Relayer / Indexer**: Indexes on-chain events, provides efficient queries for lists, votes (encrypted), and ranking data.

### Frontend
- React + TypeScript application delivering:
  - List browsing, search, and detail views.
  - Secure vote flow with client-side encryption.
  - Staking UI for optional boosted voting.
  - Dashboard for curators and reward claims.

## Technology Stack

### Blockchain & Crypto
- **fhEVM** — EVM-compatible environment with support for privacy-preserving computation primitives.
- **Solidity (>=0.8.x)** — Smart contracts.
- **OpenZeppelin** — Standard secure contract libraries.
- **Hardhat** — Development, testing, and deployment tooling.

### Frontend & Tooling
- **React 18 + TypeScript**
- **Ethers.js** — Contract interaction
- **Tailwind CSS** — Styling
- **Vercel / Netlify** — Deployment
- **Local dev**: Node.js 18+, npm / yarn / pnpm

## Installation

### Prerequisites
- Node.js 18 or newer
- npm, yarn, or pnpm
- An Ethereum-compatible wallet for testing (MetaMask, WalletConnect)

### Local Setup
```bash
# Install dependencies (root)
npm install

# Compile smart contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy contracts (configure hardhat.config.js / network settings)
npx hardhat run scripts/deploy.ts --network <network-name>

# Start frontend (from /frontend)
cd frontend
npm install
npm run dev
```

## Usage

- **Create a List**: Provide a title, description, and items. Optionally stake tokens to promote.
- **Cast an Anonymous Vote**: The client encrypts the vote and submits it; the vote is stored on-chain encrypted.
- **View Rankings**: Aggregated results are published after privacy-preserving tallying; users can view ranked lists.
- **Claim Rewards**: Curators and eligible voters can claim token rewards according to contract rules.

## Security Considerations

- **Client-side trust**: Users must trust the client to perform proper encryption. Use open-source client code and reproducible builds.
- **Key management**: Secure handling of encryption keys is critical; ephemeral and deterministic keying strategies should be audited.
- **Contract audits**: Smart contracts that handle funds and rewards require professional security audits.
- **Tally correctness**: Aggregation and proof systems should be verifiable; publish proofs or verification artifacts when possible.

## Governance & Tokenomics (optional)
- Support DAO-driven governance for parameter changes, reward schedules, and feature proposals.
- Token-based staking mechanisms can be used to weight votes or fund rewards.

## Roadmap & Future Enhancements
- Native integration with Full Homomorphic Encryption (FHE) libraries for on-chain-compatible private computation.
- Cross-chain bridges and multi-network deployments.
- DAO governance module with token-weighted proposals and voting.
- Mobile-friendly wallet-less contribution flows.
- Advanced reputation and quality metrics for curators and list items.

## Contributing
Contributions are welcome. Please open issues or pull requests describing:
- Bug fixes
- Feature proposals
- Security improvements
- Documentation and UI enhancements

## License
This project is released under the MIT License.

---

Built with care for private, transparent, and community-first content curation on Web3.
