# Zengo Solana WalletConnect Demo dApp

<p align="center">
  <img src="src/assets/zengo-logo.svg" alt="ZenGo Solana WalletConnect Demo" width="180"/>
</p>

## About

This demo dApp was created by [ZenGo](https://zengo.com) while developing Solana support and testing WalletConnect integration. It provides a comprehensive example of how to integrate Solana blockchain functionality with WalletConnect in a React application.

## Features

- Connect to Solana wallets using WalletConnect
- Switch between Devnet and Mainnet environments
- Sign and send transactions
- Sign, verify and manage messages
- SPL Token transfers
- Balance checking
- Support for both legacy and versioned transactions

## Prerequisites

- Node.js (v18 or higher recommended)
- A Solana wallet (Phantom, Solflare, or any WalletConnect compatible wallet)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/zengoX/Solana-dapp.git
cd Solana-dapp
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:

```
VITE_PROJECT_ID=your_project_id
VITE_APP_URL=http://localhost:5173
VITE_DEFAULT_NETWORK=devnet # or mainnet
VITE_RPC_URL_DEVNET=https://api.devnet.solana.com
VITE_RPC_URL_MAINNET=https://api.mainnet-beta.solana.com
```

Note: You'll need to obtain a `VITE_PROJECT_ID` from [WalletConnect Cloud](https://cloud.walletconnect.com/sign-in) for your own deployment.

## Development

Start the development server:

```bash
npm run dev
```

This will start the application on `http://localhost:5173` (or another port if 5173 is already in use).

## Building for Production

To build the application for production:

```bash
npm run build
```

The built files will be in the `dist` directory and can be served by any static file server.

## Usage

1. **Connect Your Wallet**: Use the "Connect Wallet" button to connect via WalletConnect or directly through wallet extensions.

2. **View Account Information**: Once connected, you can see your account address and balance.

3. **Perform Operations**:

   - Sign messages and verify signatures
   - Create and sign transactions
   - Send SOL to other addresses
   - Send SPL tokens
   - Sign multiple transactions at once
   - Execute versioned transactions (v0)

4. **Switch Networks**: The application supports both Devnet and Mainnet environments. The default is determined by your `.env` configuration.

## Project Structure

- `src/App.tsx`: Main application component with all wallet functionality
- `src/main.tsx`: Application entry point
- `src/assets/`: Logos and images
- Environment configuration is handled through `.env` file

## Customization

You can customize the application by:

1. Modifying the `.env` file to change network defaults
2. Adding more wallet adapters in the `solanaAdapter` configuration
3. Extending the App.tsx file with additional Solana functionality
4. Updating the UI and branding in the components

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

Copyright (c) 2025 ZenGo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
