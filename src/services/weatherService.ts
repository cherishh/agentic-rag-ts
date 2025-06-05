import { WEATHER_CONFIG } from '../config';

interface WeatherData {
  city: string;
  temperature: number;
  description: string;
  humidity: number;
  windSpeed: number;
  feelsLike: number;
}

interface WeatherAPIResponse {
  location: {
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
    tz_id: string;
    localtime_epoch: number;
    localtime: string;
  };
  current: {
    last_updated_epoch: number;
    last_updated: string;
    temp_c: number;
    temp_f: number;
    is_day: number;
    condition: {
      text: string;
      icon: string;
      code: number;
    };
    wind_mph: number;
    wind_kph: number;
    wind_degree: number;
    wind_dir: string;
    pressure_mb: number;
    pressure_in: number;
    precip_mm: number;
    precip_in: number;
    humidity: number;
    cloud: number;
    feelslike_c: number;
    feelslike_f: number;
    windchill_c: number;
    windchill_f: number;
    heatindex_c: number;
    heatindex_f: number;
    dewpoint_c: number;
    dewpoint_f: number;
    vis_km: number;
    vis_miles: number;
    uv: number;
    gust_mph: number;
    gust_kph: number;
  };
}

export class WeatherService {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = WEATHER_CONFIG.apiKey;
    this.baseUrl = WEATHER_CONFIG.baseUrl;
  }

  /**
   * 获取城市天气信息
   */
  async getWeather(city: string): Promise<WeatherData> {
    if (!this.apiKey) {
      throw new Error('天气API密钥未配置，请在环境变量中设置 WEATHER_API_KEY');
    }

    try {
      const url = `${this.baseUrl}/current.json?q=${encodeURIComponent(city)}&key=${this.apiKey}`;

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('天气API密钥无效，请检查 WEATHER_API_KEY 配置');
        } else if (response.status === 400) {
          throw new Error(`无法找到城市 "${city}"，请检查城市名称是否正确`);
        } else {
          throw new Error(`天气API请求失败: ${response.status} ${response.statusText}`);
        }
      }

      const data = (await response.json()) as WeatherAPIResponse;

      // 验证响应数据完整性
      if (!data.location || !data.current || !data.current.condition) {
        throw new Error('天气API返回的数据格式不完整');
      }

      return {
        city: data.location.name,
        temperature: Math.round(data.current.temp_c),
        description: data.current.condition.text,
        humidity: data.current.humidity,
        windSpeed: Math.round(data.current.wind_kph * 10) / 10,
        feelsLike: Math.round(data.current.feelslike_c),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`获取天气信息失败: ${String(error)}`);
    }
  }

  /**
   * 格式化天气信息为用户友好的文本
   */
  formatWeatherInfo(weather: WeatherData): string {
    return `📍 ${weather.city}的天气信息：
🌡️ 当前温度：${weather.temperature}°C（体感温度：${weather.feelsLike}°C）
☁️ 天气状况：${weather.description}
💧 湿度：${weather.humidity}%
💨 风速：${weather.windSpeed} km/h

*数据来源：WeatherAPI.com`;
  }
}

// 创建全局天气服务实例
export const weatherService = new WeatherService();
