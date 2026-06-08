import os
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

TAVILY_API_KEY = os.getenv('TAVILY_API_KEY', '')


class WebSearchTool:
    """AI Agent 专用联网搜索工具"""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or TAVILY_API_KEY
        self.tavily_client = None
        
        if self.api_key:
            masked_key = f"{self.api_key[:8]}...{self.api_key[-4:]}" if len(self.api_key) > 12 else "***"
            logger.info(f"🔑 检测到 Tavily API Key: {masked_key}")
            
            try:
                from tavily import TavilyClient
                self.tavily_client = TavilyClient(api_key=self.api_key)
                logger.info("✅ Tavily 客户端初始化成功 - 将使用 Tavily 作为主搜索引擎")
            except Exception as e:
                logger.warning(f"⚠️ Tavily 初始化失败: {e}，将回退到 Bing 搜索")
        else:
            logger.warning("⚠️ 未配置 TAVILY_API_KEY，将使用 Bing 作为备用搜索引擎")
            logger.info("💡 提示: 可在 .env 文件中配置 TAVILY_API_KEY 以获得更好的搜索体验")
    
    def is_available(self) -> bool:
        return self.tavily_client is not None
    
    async def search_tavily(self, query: str, max_results: int = 5) -> Dict[str, Any]:
        """使用 Tavily API 搜索（主引擎）"""
        if not self.tavily_client:
            raise Exception("Tavily 未配置")
        
        logger.info(f"🔍 [Tavily] 开始搜索: {query[:50]}...")
        
        try:
            response = self.tavily_client.search(
                query=query,
                search_depth="advanced",
                max_results=max_results,
                include_answer=True,
                include_raw_content=True,
                include_images=False
            )
            
            results = []
            for item in response.get('results', []):
                results.append({
                    'title': item.get('title', ''),
                    'snippet': item.get('content', '')[:300],
                    'url': item.get('url', ''),
                    'source': 'Tavily',
                    'score': item.get('score', 0)
                })
            
            logger.info(f"✅ [Tavily] 搜索成功，找到 {len(results)} 条结果")
            
            return {
                'success': True,
                'engine': 'Tavily',
                'query': query,
                'results': results,
                'answer': response.get('answer', ''),
                'total_results': len(results)
            }
        except Exception as e:
            logger.error(f"❌ [Tavily] 搜索失败: {e}")
            raise
    
    async def search_bing_fallback(self, query: str, max_results: int = 5) -> Dict[str, Any]:
        """使用 Bing 搜索（备用引擎）"""
        import httpx
        from bs4 import BeautifulSoup
        
        results = []
        
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                }
                
                response = await client.get(
                    'https://cn.bing.com/search',
                    params={'q': query, 'setlang': 'zh-CN', 'count': max_results},
                    headers=headers
                )
                
                if response.status_code == 200:
                    soup = BeautifulSoup(response.text, 'html.parser')
                    
                    for item in soup.select('li.b_algo')[:max_results]:
                        title_elem = item.select_one('h2 a')
                        snippet_elem = item.select_one('.b_caption p')
                        
                        if title_elem:
                            title = title_elem.get_text(strip=True)
                            url = title_elem.get('href', '')
                            snippet = snippet_elem.get_text(strip=True) if snippet_elem else ''
                            
                            if title and (snippet or url):
                                results.append({
                                    'title': title,
                                    'snippet': snippet or f'点击查看详情: {title}',
                                    'url': url,
                                    'source': 'Bing'
                                })
            
            return {
                'success': len(results) > 0,
                'engine': 'Bing (备用)',
                'query': query,
                'results': results,
                'answer': '',
                'total_results': len(results)
            }
        except Exception as e:
            logger.error(f"Bing 搜索失败: {e}")
            return {'success': False, 'engine': 'Bing', 'results': [], 'error': str(e)}
    
    async def search(self, query: str, max_results: int = 5) -> Dict[str, Any]:
        """智能搜索 - 自动选择最佳引擎"""
        
        if self.is_available():
            try:
                result = await self.search_tavily(query, max_results)
                if result['success'] and result['results']:
                    logger.info(f"✅ Tavily 搜索成功: {len(result['results'])} 条结果")
                    return result
            except Exception as e:
                logger.warning(f"⚠️ Tavily 失败，切换到 Bing: {e}")
        
        logger.info("🔄 使用 Bing 备用搜索...")
        bing_result = await self.search_bing_fallback(query, max_results)
        
        if bing_result['success']:
            logger.info(f"✅ Bing 搜索成功: {len(bing_result['results'])} 条结果")
        
        return bing_result


def need_web_search(query: str) -> bool:
    """智能判断是否需要联网搜索"""
    
    keywords_require_search = [
        '最新', '今天', '现在', '新闻', '发布', '版本', 
        '官网', 'github', '价格', '下载', '安装',
        '是什么', '干嘛用的', '怎么用', '如何使用',
        '服务是', '什么意思', '介绍', '解释'
    ]
    
    time_related = ['2024', '2025', '2026', '最近', '近期']
    
    query_lower = query.lower()
    
    for keyword in keywords_require_search:
        if keyword in query_lower:
            return True
    
    for keyword in time_related:
        if keyword in query_lower:
            return True
    
    service_patterns = [
        r'.+?服务\s*(?:是)?(?:什么|干嘛|干吗|做什么|用来)',
        r'(?:什么是|介绍|解释|说明).+?服务',
        r'.+?\s*(?:服务的?(?:作用|用途|功能|目的)|干什么用的)'
    ]
    
    import re
    for pattern in service_patterns:
        if re.search(pattern, query, re.IGNORECASE):
            return True
    
    return False


web_search_tool = WebSearchTool()
