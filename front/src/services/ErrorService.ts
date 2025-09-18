// сервис обработки ошибок
import { BaseError, ContractFunctionRevertedError } from 'viem';

export interface DecodedError {
  message: string;
  type: 'error' | 'warning' | 'info';
  details?: string;
}

export class ErrorService {
  private static instance: ErrorService;

  static getInstance(): ErrorService {
    if (!ErrorService.instance) {
      ErrorService.instance = new ErrorService();
    }
    return ErrorService.instance;
  }

  // Декодирование ошибок контракта
  decodeContractError(error: unknown): DecodedError {
    console.error('Raw error:', error);

    // Проверка на RPC ошибку (например, от MetaMask)
    if (typeof error === 'object' && error !== null) {
      const err = error as Record<string, any>;
      
      // Обработка ошибок от MetaMask/RPC
      if (err.code === -32603) {
        return {
          message: 'Internal JSON-RPC error',
          type: 'error',
          details: 'An internal error occurred in the RPC server. This may be due to network issues or invalid transaction parameters.'
        };
      }
      
      if (err.code === 4001) {
        return {
          message: 'Transaction rejected by user',
          type: 'warning',
          details: 'You rejected the transaction in your wallet'
        };
      }

      // Обработка ошибок, которые могут прийти от провайдера
      if (err.code && err.message) {
        return {
          message: err.message,
          type: 'error',
          details: `Error code: ${err.code}`
        };
      }
    }

    // Проверяем, является ли ошибка ошибкой viem
    if (error instanceof BaseError) {
      // Ищем revert error внутри
      const revertError = error.walk(err => err instanceof ContractFunctionRevertedError);
      
      if (revertError instanceof ContractFunctionRevertedError) {
        return this.handleRevertError(revertError);
      }

      // Если это BaseError, но не revert, то возвращаем сообщение
      return {
        message: error.shortMessage || error.message,
        type: 'error',
        details: 'A network error occurred'
      };
    }

    // Обработка обычных JavaScript ошибок
    if (error instanceof Error) {
      return this.handleGenericError(error);
    }

    // Неизвестная ошибка
    return {
      message: 'Unknown error occurred',
      type: 'error',
      details: String(error)
    };
  }

  private handleRevertError(error: ContractFunctionRevertedError): DecodedError {
    // Здесь добавляем обработку кастомных ошибок из контракта
    const { data } = error;

    if (data && data.errorName) {
      // Обработка конкретных кастомных ошибок
      switch (data.errorName) {
        case 'FVErrorDeadlineLessMinimun':
          return {
            message: 'Campaign duration is too short',
            type: 'error',
            details: 'Please increase the campaign duration'
          };
        
        case 'InsufficientDeposit':
          return {
            message: 'Insufficient deposit',
            type: 'error',
            details: 'Please provide the required deposit amount'
          };
        
        case 'InvalidToken':
          return {
            message: 'Invalid token address',
            type: 'error',
            details: 'Please select a valid token'
          };
        
        // Добавить другие кастомные ошибки
        
        default:
          return {
            message: `Contract error: ${data.errorName}`,
            type: 'error',
            details: data.args ? JSON.stringify(data.args) : undefined
          };
      }
    }

    // Общая revert ошибка без кастомных данных
    return {
      message: 'Transaction reverted',
      type: 'error',
      details: 'The contract rejected the transaction. This may be due to invalid parameters or insufficient funds.'
    };
  }

  private handleGenericError(error: Error): DecodedError {
    // Обработка специфических ошибок подключения
    if (error.message.includes('user rejected')) {
      return {
        message: 'Transaction rejected',
        type: 'warning',
        details: 'You rejected the transaction in your wallet'
      };
    }

    if (error.message.includes('Internal JSON-RPC')) {
      return {
        message: 'Network error',
        type: 'error',
        details: 'Please check your network connection and try again'
      };
    }

    // Общая ошибка
    return {
      message: error.message,
      type: 'error',
      details: 'An unexpected error occurred'
    };
  }

  // Вспомогательный метод для быстрого использования
  static handleError(error: unknown): DecodedError {
    return ErrorService.getInstance().decodeContractError(error);
  }
}

export const errorService = ErrorService.getInstance();