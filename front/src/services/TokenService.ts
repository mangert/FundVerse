import { zeroAddress, type PublicClient } from 'viem';
import { PlatformABI } from '../utils/abi';
import { PLATFORM_ADDRESS } from '../utils/addresses';
import { BASE_TOKENS, type BaseTokensKey } from '../config/tokens';

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  status: boolean;
}

class TokenService {
  private static instance: TokenService;
  private tokens: Map<string, TokenInfo> = new Map();
  private publicClient: PublicClient | null = null;

  static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  // Инициализация сервиса
  async init(publicClient: PublicClient) {
    this.publicClient = publicClient;
    this.loadFromConfig();
    this.loadFromStorage();
    await this.setupEventListeners();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('supported-tokens');
      if (stored) {
        const storedTokens = JSON.parse(stored);
        
        // Восстанавливаем токены из localStorage
        for (const [address, tokenInfo] of Object.entries(storedTokens)) {
          this.tokens.set(address, tokenInfo as TokenInfo);
        }
        
        console.log('Loaded tokens from storage:', this.tokens.size);
      }
    } catch (error) {
      console.warn('Failed to load tokens from storage:', error);
    }
  }

  private saveToStorage() {
    try {
      const tokensObject = Object.fromEntries(this.tokens);
      localStorage.setItem('supported-tokens', JSON.stringify(tokensObject));
    } catch (error) {
      console.warn('Failed to save tokens to storage:', error);
    }
  }

  private async fetchTokenInfo(address: string): Promise<TokenInfo> {
    if (!this.publicClient) {
      throw new Error('Public client not initialized');
    }

    try {
      // Получаем symbol и decimals с контракта токена
      const [symbol, decimals] = await Promise.all([
        this.publicClient.readContract({
          address: address as `0x${string}`,
          abi: [{  // Минимальный ABI для ERC20 токенов
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
          abi: [{  // Минимальный ABI для ERC20 токенов
            inputs: [],
            name: 'decimals',
            outputs: [{ name: '', type: 'uint8' }],
            stateMutability: 'view',
            type: 'function'
          }],
          functionName: 'decimals',
          args: []
        }) as Promise<number>
      ]);

      return {
        address,
        symbol,
        decimals,
        name: symbol, // Можно добавить отдельный вызов для name если нужно
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

  // Загрузка базового конфига
  private loadFromConfig() {
    const chainId = this.publicClient?.chain?.id;
    if (!chainId) return;

    // Динамическая проверка: есть ли chainId в конфиге
    const chainIdKey = String(chainId) as unknown as BaseTokensKey;
    
    if (!(chainIdKey in BASE_TOKENS)) {
        console.warn(`No config found for chainId: ${chainId}`);
        return;
    }

    const config = BASE_TOKENS[chainIdKey];
    
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
  
  // Подписка на события
  private async setupEventListeners() {
    if (!this.publicClient) return;

    // Событие добавления токена
    this.publicClient.watchContractEvent({
      address: PLATFORM_ADDRESS,
      abi: PlatformABI,
      eventName: 'FVNewTokenAdded',
      onLogs: (logs) => {
        logs.forEach(log => {
        // Просто используем any для быстрого решения
            const tokenAddress = (log as any).args?.token;
            if (tokenAddress) {
                this.handleTokenAdded(tokenAddress);
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
        logs.forEach(log => {
        // Просто используем any для быстрого решения
            const tokenAddress = (log as any).args?.token;
            if (tokenAddress) {
                this.handleTokenAdded(tokenAddress);
            }
        });
      }
    });
  }

  // Обработчики событий
  private async handleTokenAdded(tokenAddress: string) {
    const tokenInfo = await this.fetchTokenInfo(tokenAddress);
    this.tokens.set(tokenAddress, { ...tokenInfo, status: true });
    this.saveToStorage();
  }

  private handleTokenRemoved(tokenAddress: string) {
    const token = this.tokens.get(tokenAddress);
    if (token) {
      token.status = false; // Деактивируем, но не удаляем
      this.saveToStorage();
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