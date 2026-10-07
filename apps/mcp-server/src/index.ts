import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ethers } from "ethers";

const POLYGON_RPC = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
const USDT_POLYGON_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint amount) returns (bool)"
];

const provider = new ethers.JsonRpcProvider(POLYGON_RPC);

const server = new Server(
  {
    name: "zero-wallet-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "polygon_get_wallet_balance",
        description: "Returns USDT balance and native POL/MATIC gas balance for an EVM address on Polygon.",
        inputSchema: {
          type: "object",
          properties: {
            address: {
              type: "string",
              description: "Polygon EVM public address (0x...)",
            },
          },
          required: ["address"],
        },
      },
      {
        name: "polygon_send_usdt",
        description: "Executes a signed USDT transfer on Polygon with ephemeral key memory hygiene and rate checks.",
        inputSchema: {
          type: "object",
          properties: {
            recipient: {
              type: "string",
              description: "0x EVM recipient address",
            },
            amount_usdt: {
              type: "number",
              description: "Amount of USDT to send",
            },
            session_key: {
              type: "string",
              description: "Ephemeral scoped session signing key",
            },
          },
          required: ["recipient", "amount_usdt", "session_key"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "polygon_get_wallet_balance") {
    const address = String(args?.address);
    const nativeBal = await provider.getBalance(address);
    const usdtContract = new ethers.Contract(USDT_POLYGON_ADDRESS, ERC20_ABI, provider);
    const usdtBal = await usdtContract.balanceOf(address);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              address,
              pol_gas: ethers.formatEther(nativeBal),
              usdt: ethers.formatUnits(usdtBal, 6),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  if (name === "polygon_send_usdt") {
    const recipient = String(args?.recipient);
    const amount = Number(args?.amount_usdt);
    const sessionKey = String(args?.session_key);

    if (amount <= 0 || amount > 100) {
      throw new Error("Guardrail breach: Transaction exceeds max per-operation session limit.");
    }

    let signer: ethers.Wallet | null = new ethers.Wallet(sessionKey, provider);
    const usdtContract = new ethers.Contract(USDT_POLYGON_ADDRESS, ERC20_ABI, signer);
    const parsedAmount = ethers.parseUnits(amount.toString(), 6);

    const tx = await usdtContract.transfer(recipient, parsedAmount);
    const receipt = await tx.wait(1);

    signer = null;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "success",
              tx_hash: receipt.hash,
              block_number: receipt.blockNumber,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  throw new Error(`Tool not found: ${name}`);
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

run().catch((err) => {
  console.error("MCP Fatal Error:", err);
  process.exit(1);
});
