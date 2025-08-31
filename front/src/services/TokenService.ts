import { zeroAddress, type PublicClient, parseAbiItem, type Log } from 'viem';
import { PlatformABI } from '../utils/abi';
import { PLATFORM_ADDRESS } from '../utils/addresses';
import { BASE_TOKENS } from '../config/tokens';
import type { TokenConfig, NetworkTokensConfig } from '../config/tokens';

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  status: boolean;
  addedAtBlock?: number;
  removedAtBlock?: number;
}

// Простые интерфейсы для событий
interface FVNewTokenAddedEvent extends Log {
  args: {
    token: string;
  };
}

interface FVTokenRemovedEvent extends Log {
  args: {
    token: string;
  };
}

class TokenService {
  private static instance: TokenService;
  private tokens: Map<string, TokenInfo> = new Map();
  private publicClient: PublicClient | null = null;
  private currentChainId: number | null = null;

  static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  async init(publicClient: PublicClient) {
    this.publicClient = publicClient;
    this.currentChainId = publicClient.chain?.id || null;
    
    if (!this.currentChainId) {
      console.warn('No chain ID available');
      return;
    }

    // Загружаем базовые токены из конфига
    this.loadFromConfig();
    
    // Загружаем актуальные события из блокчейна
    await this.loadEventsFromBlockchain();
    
    // Подписываемся на будущие события
    await this.setupEventListeners();
  }

  private loadFromConfig() {
    const chainId = this.currentChainId;
    if (!chainId || !(chainId in BASE_TOKENS)) {
      console.warn(`No config found for chainId: ${chainId}`);
      return;
    }

    const config = BASE_TOKENS[chainId] as NetworkTokensConfig;
    
    // Добавляем нативную валюту
    this.tokens.set(zeroAddress, {
      address: zeroAddress,
      symbol: config.native.symbol,
      decimals: config.native.decimals,
      name: config.native.name,
      status: true
    });

    // Добавляем токены из конфига
    config.tokens.forEach(token => {
      this.tokens.set(token.address, { ...token });
    });
  }

  private async loadEventsFromBlockchain() {
    if (!this.publicClient || !this.currentChainId) return;

    const config = BASE_TOKENS[this.currentChainId] as NetworkTokensConfig;
    if (!config) return;

    const fromBlock = BigInt(config.contractDeploymentBlock);
    const toBlock = await this.publicClient.getBlockNumber();

    try {
      // Загружаем события добавления токенов
      const addEvents = await this.publicClient.getLogs({
        address: PLATFORM_ADDRESS,
        event: parseAbiItem('event FVNewTokenAdded(address token)'),
        fromBlock,
        toBlock
      }) as FVNewTokenAddedEvent[];

      // Загружаем события удаления токенов
      const removeEvents = await this.publicClient.getLogs({
        address: PLATFORM_ADDRESS,
        event: parseAbiItem('event FVTokenRemoved(address token)'),
        fromBlock,
        toBlock
      }) as FVTokenRemovedEvent[];

      // Обрабатываем события добавления
      for (const event of addEvents) {
        const tokenAddress = event.args.token;
        if (tokenAddress && !this.tokens.has(tokenAddress)) {
          await this.handleTokenAdded(tokenAddress, Number(event.blockNumber));
        }
      }

      // Обрабатываем события удаления
      for (const event of removeEvents) {
        const tokenAddress = event.args.token;
        if (tokenAddress && this.tokens.has(tokenAddress)) {
          this.handleTokenRemoved(tokenAddress, Number(event.blockNumber));
        }
      }
    } catch (error) {
      console.warn('Failed to load events from blockchain:', error);
    }
  }

  private async handleTokenAdded(tokenAddress: string, blockNumber?: number) {
    if (!this.publicClient) return;

    try {
      const tokenInfo = await this.fetchTokenInfo(tokenAddress);
      this.tokens.set(tokenAddress, {
        ...tokenInfo,
        status: true,
        addedAtBlock: blockNumber
      });
    } catch (error) {
      console.warn(`Failed to fetch info for token ${tokenAddress}:`, error);
    }
  }

  private handleTokenRemoved(tokenAddress: string, blockNumber?: number) {
    const token = this.tokens.get(tokenAddress);
    if (token) {
      token.status = false;
      token.removedAtBlock = blockNumber;
    }
  }

  private async fetchTokenInfo(address: string): Promise<TokenInfo> {
    if (!this.publicClient) {
      throw new Error('Public client not initialized');
    }

    try {
      const [symbol, decimals, name] = await Promise.all([
        this.publicClient.readContract({
          address: address as `0x${string}`,
          abi: [{
            inputs: [],
            name: 'symbol',
            outputs: [{ name: '', type: 'string' }],
            stateMutability: 'view',
            type: 'function'
          }],
          functionName: 'symbol',
          args: []
        }) as Promise<string>,
        
        this.publicClient.readContract({
          address: address as `0x${string}`,
          abi: [{
            inputs: [],
            name: 'decimals',
            outputs: [{ name: '', type: 'uint8' }],
            stateMutability: 'view',
            type: 'function'
          }],
          functionName: 'decimals',
          args: []
        }) as Promise<number>,
        
        this.publicClient.readContract({
          address: address as `0x${string}`,
          abi: [{
            inputs: [],
            name: 'name',
            outputs: [{ name: '', type: 'string' }],
            stateMutability: 'view',
            type: 'function'
          }],
          functionName: 'name',
          args: []
        }) as Promise<string>
      ]);

      return {
        address,
        symbol,
        decimals,
        name,
        status: true
      };
    } catch (error) {
      console.error('Failed to fetch token info:', error);
      
      // Возвращаем базовую информацию в случае ошибки
      return {
        address,
        symbol: 'UNKNOWN',
        decimals: 18,
        name: 'Unknown Token',
        status: true
      };
    }
  }

  private async setupEventListeners() {
    if (!this.publicClient) return;

    try {
      // Событие добавления токена
      this.publicClient.watchContractEvent({
        address: PLATFORM_ADDRESS,
        abi: PlatformABI,
        eventName: 'FVNewTokenAdded',
        onLogs: (logs) => {
          (logs as FVNewTokenAddedEvent[]).forEach(log => {
            const tokenAddress = log.args.token;
            if (tokenAddress) {
              this.handleTokenAdded(tokenAddress, Number(log.blockNumber));
            }
          });
        }
      });

      // Событие удаления токена
      this.publicClient.watchContractEvent({
        address: PLATFORM_ADDRESS,
        abi: PlatformABI,
        eventName: 'FVTokenRemoved',
        onLogs: (logs) => {
          (logs as FVTokenRemovedEvent[]).forEach(log => {
            const tokenAddress = log.args.token;
            if (tokenAddress) {
              this.handleTokenRemoved(tokenAddress, Number(log.blockNumber));
            }
          });
        }
      });
    } catch (error) {
      console.warn('Failed to setup event listeners:', error);
    }
  }

  // Публичные методы для компонентов
  getTokenInfo(address: string): TokenInfo | undefined {
    return this.tokens.get(address);
  }

  getActiveTokens(): TokenInfo[] {
    return Array.from(this.tokens.values()).filter(token => token.status);
  }

  getAllTokens(): TokenInfo[] {
    return Array.from(this.tokens.values());
  }

  getNativeToken(): TokenInfo {
    return this.tokens.get(zeroAddress)!;
  }
}

export const tokenService = TokenService.getInstance();