// src/services/TokenService.ts
import { zeroAddress } from "viem";

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  status: boolean;
  addedAtBlock?: number;
  removedAtBlock?: number;
}

class TokenService {
  private static instance: TokenService;
  private tokens: Map<string, TokenInfo> = new Map();
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL = 30_000; // 30 секунд
  private readonly API_BASE = import.meta.env.VITE_INDEXER_API || "http://localhost:4000/api";

  static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  async init() {
    console.log("Initializing TokenService via backend indexer...");

    try {
      await this.fetchTokens();
      this.startPolling();
      console.log("TokenService initialized successfully");
    } catch (error) {
      console.error("Failed to initialize TokenService:", error);
    }
  }

  private async fetchTokens() {
    try {
      const res = await fetch(`${this.API_BASE}/tokens`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const tokens: TokenInfo[] = await res.json();

      this.tokens.clear();
      tokens.forEach((t) => this.tokens.set(t.address.toLowerCase(), t));

      console.log(`Loaded ${tokens.length} tokens from indexer`);
    } catch (err) {
      console.error("Error fetching tokens from backend:", err);
    }
  }

  private startPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);

    this.pollingInterval = setInterval(() => {
      this.fetchTokens();
    }, this.POLL_INTERVAL);

    console.log("Started polling indexer API for tokens");
  }

  // 🔹 ВОССТАНОВЛЕННЫЙ метод
  getNativeToken(): TokenInfo {
    const native = this.tokens.get(zeroAddress);
    if (!native) {
      return {
        address: zeroAddress,
        symbol: "ETH", // fallback
        decimals: 18,
        name: "Ethereum",
        status: true,
      };
    }
    return native;
  }

  getTokenInfo(address: string): TokenInfo | undefined {
    return this.tokens.get(address.toLowerCase());
  }

  getActiveTokens(): TokenInfo[] {
    return Array.from(this.tokens.values()).filter((t) => t.status);
  }

  getAllTokens(): TokenInfo[] {
    return Array.from(this.tokens.values());
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log("TokenService polling stopped");
    }
  }

  forceRefresh() {
    this.fetchTokens();
  }
}

export const tokenService = TokenService.getInstance();
