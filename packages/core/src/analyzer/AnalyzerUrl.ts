import axios from 'axios'
import { load } from 'cheerio'
import iconv from 'iconv-lite'
import contentType from 'content-type'
import chardet from 'chardet'
import type { Rule } from '@any-reader/rule-utils'
import { JSEngine } from './JSEngine'

const http = axios.create()

/**
*
* @param url
* @param keyword
* @param result
* @returns
*/
export async function fetch(url: string, keyword = '', result = '', rule: Rule) {
  const vars: any = {
    $keyword: keyword,
    searchKey: keyword,
    $host: rule.host,
    $result: result,
    searchPage: 1,
    $page: 1,
    $pageSize: 20,
  }

  let params: any = {
    method: 'get',
    url,
  }

  // TODO: 编码 encoding
  if (params.url.startsWith('@js:')) {
    params = JSEngine.evaluate(url.substring(4), {
      ...vars,
      keyword,
    })
  }
  else {
    params.url = params.url.replace(
      /\$keyword|\$page|\$host|\$result|\$pageSize|searchKey|searchPage/g,
      (m: string | number) => vars[m] || '',
    )
    if (params.url.startsWith('{'))
      Object.assign(params, JSON.parse(params.url))

    const host = rule.host.trim()
    if (params.url.startsWith('//')) {
      if (host.startsWith('https'))
        params.url = `https:${params.url}`
      else params.url = `http:${params.url}`
    }
    else if (
      !params.url.startsWith('http')
     && !params.url.startsWith('ftp')
    ) {
      params.url = host + params.url
    }

    if (params.method === 'post' && typeof params.body === 'object') {
      Object.assign(params, {
        body: undefined,
        data: params.body,
      })
    }
  }

  if (!params.headers)
    params.headers = { }

  const ua = rule.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36 Edg/98.0.1108.50'
  if (typeof ua === 'string') {
    if (ua.startsWith('{') && ua.endsWith('}'))
      Object.assign(params.headers, JSON.parse(ua))
    else
      params.headers['User-Agent'] = ua
  }
  else if (typeof ua === 'object') {
    Object.assign(params.headers, ua)
  }

  let ruleEncoding = params.encoding
  if (ruleEncoding === 'gb2312')
    ruleEncoding = 'gbk'

  const body = await http({
    ...params,
    responseType: 'arraybuffer',
    responseEncoding: undefined,
  })
    .then((e) => {
      const ct = contentType.parse(e.headers['content-type'] || '')
      const charset = ct.parameters.charset
      let encoding = charset || ruleEncoding
      if (!encoding)
        encoding = chardet.detect(e.data)

      let str = iconv.decode(e.data, encoding || 'utf8')
      if (ct.type === 'text/html' && /<!doctype html>/i.test(str))
        str = load(str, null, true).html()

      return str
    })

  return {
    params,
    body,
  }
}

// 在 eso 是返回字符串
export async function __http__(url: string, rule: Rule): Promise<string> {
  return (await fetch(url, '', '', rule)).body
}
