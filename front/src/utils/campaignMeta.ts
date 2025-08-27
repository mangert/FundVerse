export interface CampaignMeta {
  name?: string;
  desc?: string;
  info?: string;
  image?: string;
  [key: string]: any; // Для дополнительных полей
}

// Парсим campaignMeta строку
export const parseCampaignMeta = (metaString: string): CampaignMeta => {
  if (!metaString || metaString.trim() === '') {
    return { name: 'Unnamed Campaign' };
  }

  try {
    // Пробуем распарсить JSON
    const parsed = JSON.parse(metaString);
    
    // Проверяем, что распарсился объект
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        name: parsed.name || 'Unnamed Campaign',
        desc: parsed.desc,
        info: parsed.info,
        image: parsed.image,
        ...parsed // Сохраняем все остальные поля
      };
    }
    
    return { name: 'Unnamed Campaign' };
  } catch (error) {
    // Если не JSON, возможно это просто строка с именем
    if (typeof metaString === 'string' && metaString.length > 0) {
      return { name: metaString };
    }
    
    return { name: 'Unnamed Campaign' };
  }
};

// Создаем campaignMeta строку из объекта
export const createCampaignMeta = (meta: CampaignMeta): string => {
  try {
    return JSON.stringify(meta);
  } catch (error) {
    console.error('Failed to stringify campaign meta:', error);
    return JSON.stringify({ name: 'Unnamed Campaign' });
  }
};

// Получаем название кампании (с fallback)
export const getCampaignName = (metaString: string): string => {
  const meta = parseCampaignMeta(metaString);
  return meta.name || 'Unnamed Campaign';
};