import axios from 'axios';
import { load } from 'cheerio';
import iconv from 'iconv-lite';
import contentType from 'content-type';
import chardet from 'chardet';
import type { Rule } from '@any-reader/rule-utils';
import { FetchException } from '../exception/FetchException';

const http = axios.create({
  timeout: 6000
});

// 替换变量
function replaceUrl(url: string, vars: any) {
  return url.replace(/\$keyword|\$pageSize|\$page|\$host|\$result|searchKey|searchPage/g, (m: string | number) => vars[m] || '');
}

export function parseRequest(url: string | object, keyword = '', result = '', rule: Rule, page = 1, pageSize = 20) {
  const vars: any = {
    $keyword: keyword,
    searchKey: keyword,
    $host: rule.host,
    $result: result,
    searchPage: page,
    $pageSize: pageSize,
    $page: page
  };

  let params: any = {
    method: 'get',
    url
  };

  // TODO: 编码 encoding
  if (typeof url === 'object') {
    params = url;
  }

  params.url = replaceUrl(params.url, vars);
  if (params.url.startsWith('{')) Object.assign(params, JSON.parse(params.url));

  const host = rule.host.trim();
  if (params.url.startsWith('//')) {
    if (host.startsWith('https')) params.url = `https:${params.url}`;
    else params.url = `http:${params.url}`;
  } else if (!params.url.startsWith('http') && !params.url.startsWith('ftp')) {
    params.url = host + params.url;
  }

  if (params.method === 'post' && typeof params.body === 'object') {
    Object.assign(params, {
      body: undefined,
      data: params.body
    });
  }

  if (!params.headers) params.headers = {};

  const ua =
    rule.userAgent ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36 Edg/98.0.1108.50';
  if (typeof ua === 'string') {
    if (ua.startsWith('{') && ua.endsWith('}')) Object.assign(params.headers, JSON.parse(ua));
    else params.headers['User-Agent'] = ua;
  } else if (typeof ua === 'object') {
    Object.assign(params.headers, ua);
  }

  let ruleEncoding = params.encoding;
  if (ruleEncoding === 'gb2312') ruleEncoding = 'gbk';

  return Object.assign(
    {
      responseType: 'arraybuffer',
      responseEncoding: undefined
    },
    params
  );
}

export async function fetch(params: any) {
  const body = await http(params)
    .then((e) => {
      const ct = contentType.parse(e.headers['content-type'] || '');
      let encoding = ct.parameters.charset;
      if (!encoding) encoding = chardet.detect(e.data) as string;

      let str = iconv.decode(e.data, encoding || 'utf8');
      if (ct.type === 'text/html' && /<!doctype html>/i.test(str)) str = load(str, null, true).html();

      return str;
    })
    .catch((err) => {
      throw new FetchException(err.message);
    });

  return {
    params,
    body
  };
}

// 在 eso 是返回字符串
export async function __http__(url: string, rule: Rule): Promise<string> {
  return (await fetch(parseRequest(url, '', '', rule))).body;
}
