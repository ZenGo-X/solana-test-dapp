# Solana AppKit Demo

A simple Solana dApp that demonstrates wallet integration using AppKit and WalletConnect. This project showcases wallet connection, transaction signing, and basic Solana operations.

## Features

- Multiple wallet connection methods:
  - WalletConnect QR code scanning
  - Direct wallet connections (Phantom, Solflare)
  - AppKit modal integration
- Transaction operations:
  - Check wallet balance
  - Sign messages
  - Send test transactions
- Support for both Solana mainnet and devnet
- Full React + TypeScript implementation

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A modern web browser
- A Reown Cloud project ID (get it from https://cloud.reown.com)

## Installation

1. Create a new project using Vite:

```bash
npm create vite@latest solana-appkit -- --template react-ts
cd solana-appkit
```

2. Install the required dependencies:

```bash
npm install @reown/appkit \
            @reown/appkit-adapter-solana \
            @reown/appkit-wallet-button \
            @solana/wallet-adapter-wallets \
            @solana/web3.js
```

3. Install development dependencies:

```bash
npm install tailwindcss postcss autoprefixer -D
```

4. Initialize Tailwind CSS:

```bash
npx tailwindcss init -p
```

5. Configure Tailwind CSS by updating `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

6. Add Tailwind directives to your `./src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## Configuration

1. Get your project ID from [Reown Cloud](https://cloud.reown.com)

2. Create a `.env` file in the root directory:

```env
VITE_PROJECT_ID=your_project_id_here
```

3. Update the project metadata in `App.tsx` with your project details:

```typescript
const metadata = {
  name: "Your App Name",
  description: "Your App Description",
  url: "http://localhost:3000", // Update with your production URL
  icons: ["https://your-app-icon.png"],
};
```

## Project Structure

```
solana-appkit/
├── src/
│   ├── App.tsx            # Main application component
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles
├── public/
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Running the Project

1. Start the development server:

```bash
npm run dev
```

2. Open your browser and navigate to `http://localhost:5173`

## Building for Production

1. Create a production build:

```bash
npm run build
```

2. Preview the production build:

```bash
npm run preview
```

## Usage

1. Connect your wallet using any of the available methods:

   - Click "Connect with WalletConnect QR" to scan a QR code
   - Use the direct wallet buttons for Phantom or Solflare
   - Use the AppKit modal for additional options

2. Once connected, you can:
   - Check your wallet balance
   - Sign messages
   - Send test transactions

## Support

- For AppKit issues: [AppKit Documentation](https://docs.reown.com/appkit)
- For Solana development: [Solana Documentation](https://docs.solana.com)
- For WalletConnect: [WalletConnect Documentation](https://docs.walletconnect.com)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Security

Remember to never commit your project ID or other sensitive information. Always use environment variables for sensitive data.
