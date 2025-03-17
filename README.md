# Blockchain Indexing Platform

A powerful blockchain indexing platform built on Helius webhooks that enables developers to easily integrate and index Solana blockchain data into their PostgreSQL database.

## Features

- User authentication and database management
- Customizable data indexing options
- Real-time blockchain data indexing using Helius webhooks
- Support for multiple indexing categories:
  - NFT bids and prices
  - Token borrowing availability
  - Token prices across platforms

## Tech Stack

- Next.js with TypeScript
- PostgreSQL with Prisma ORM
- Redis for caching and job queues
- Helius SDK for blockchain integration
- Docker for development environment

## Prerequisites

- Node.js 18+
- Docker and Docker Compose
- Helius API key

## Getting Started

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd blockchain-indexer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start the development environment:
   ```bash
   docker-compose up -d
   ```

5. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

7. Visit http://localhost:3000 to access the application

## Development

- `npm run dev`: Start development server
- `npm run build`: Build production version
- `npm run start`: Start production server
- `npm run test`: Run tests
- `npm run lint`: Run linting

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

MIT 