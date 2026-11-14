---
title: 免费、Serverless的EdgeOne，根域名跳转与域名邮箱如何兼容
description: EdgeOne如何让根域名的跳转与域名邮箱兼容
date: 2026-11-13
lang: zh
tags: [edgeone, dns, github-actions, cdn]
---
本博客在开始之初，就打算采取Serverless架构，避免因我自己的问题导致网站无法访问。

不得不说在AI时代来临后，整个互联网环境发生了天翻地覆的变化，我的旧博文几乎失去了参考价值。而AI带来的也远不止这些影响，在前几日PHP爆出高危漏洞后，我的旧博客本身所用的程序“Typecho”也变成了高危目标，迫使我不得不整体闭站。而这种种，也让我重新思考博客如何以一种省心、稳定的方法继续运行下去。

而我很快地选定了本博客通过Github Pages进行部署，这种部署方式完全免费，而通过Action更新网站也完全不会让我担心任何的高危漏洞。

在我改完代码并部署后，发现Github Pages依旧面临中国大陆方向的访问问题。在心中不免一声哀叹，正准备完全不考虑中国大陆方向的访问时，突然想到中国大陆内的一些厂商也有一些免费产品。

本着不用白不用的心态，我还是继续用了腾讯云的EdgeOne Makers产品。这个产品几乎是完全对标Pages，让我无需在意那么多后续维护事宜。

而在EdgeOne Makers的使用过程中，其@解析需要跳转到www的问题就出现了。这个问题一直是我的“Pain in the butt”。

在@解析跳转到www时，我不得不考虑两个非常让人头疼的问题。其一是301跳转也必须要带上SSL证书，体验才能够完美。其二是@解析记录如果用CNAME则会干扰域名邮箱。而恰好EdgeOne就不支持A解析记录接入。

本文章即为我尝试通过自制CNAME展平的方式，绕过此限制。

## 根域名的问题

www可以直接设置CNAME，而根域名则不行。我的根域名上有域名邮箱的MX记录，以及SPF等TXT记录，而DNS规范并不允许CNAME与其他记录共存。即便强行添加，DNS服务商要么直接拒绝，要么允许添加但邮件收发会变得不稳定。

我对这件事的要求是：DNS继续托管在DNSPod，邮箱的记录不做改动，根域名同样经过中国大陆的CDN节点并有SSL证书，同时不额外花钱，部署完成后也不需要我再手动维护。

市面上现成的方案我大致都看过一遍。DNSPod本身就有CNAME展平功能，可以直接解决这个问题，但仅企业版及以上提供，一年需要两千多元。EdgeOne采用NS接入时可以处理根域名，但需要将NS从DNSPod迁出并另购套餐，并且官方文档对于根域名CNAME与MX共存的描述也只是“允许配置，但可能冲突”。Cloudflare虽然免费提供展平，但展平时不会携带访客的地区信息，中国大陆的用户拿到的会是EdgeOne的海外节点，也就失去了意义。至于DNSPod的URL转发，则不支持HTTPS。用自己的服务器做301跳转当然也可以，但这样根域名就不在CDN上了，也违背了我最初选择Serverless的初衷。

## 自制CNAME展平

CNAME展平的原理并不复杂，DNS服务商会替你将CNAME解析到最终的IP，再以A记录的形式返回。这一步完全可以自己来完成：定时查询EdgeOne分配给根域名的地址解析到了哪些IP，再将结果写入DNSPod的A记录即可。而A记录与MX记录是可以共存的，域名邮箱也就不会受到影响。

这里的难点在于，CDN会根据访客所在的位置返回不同的节点。而脚本运行在Github Actions上，机器位于美国，直接查询只能拿到海外节点。

解决的办法是EDNS Client Subnet（ECS）。在查询时附带一个网段，EdgeOne便会认为这是替该网段的用户发起的查询。Google与阿里的DoH接口都支持这一参数。经过测试，附带电信的网段会返回电信节点，附带联通的网段会返回联通节点，附带美国的网段则会返回海外节点，与预期一致。

DNSPod的免费版本身就支持按线路解析，电信、联通、移动、教育网、境内和境外都可以分别设置。因此脚本只需针对每条线路，用对应运营商的网段查询一次，再将结果写到这条线路上：

```js
// DNSPod line → a Shanghai client subnet of that network (abroad for "默认").
const TELECOM = '202.96.209.0/24';
const LINES = [
  { line: '电信', subnet: TELECOM },
  { line: '联通', subnet: '210.22.70.0/24' },
  { line: '移动', subnet: '211.136.112.0/24' },
  { line: '教育网', subnet: '202.120.2.0/24' },
  { line: '境内', subnet: TELECOM },
  { line: '默认', subnet: '8.8.8.0/24' },
];

const RESOLVERS = [
  (name, type, subnet) => `https://dns.google/resolve?name=${name}&type=${type}&edns_client_subnet=${subnet}`,
  (name, type, subnet) => `https://dns.alidns.com/resolve?name=${name}&type=${type === 'A' ? 1 : 28}&edns_client_subnet=${subnet}`,
];
```

境内线路默认用电信老大哥，而ECS附带的网段，我选的都是上海地区的。上海地区位于华东，全国的距离都不会太远，且直辖市位于网络骨干。

另外也不得不感谢腾讯云海外给的IP都是Anycast任播IP，使得其他国家我不需要操心分流的问题。

## 通过Github Actions定时运行

脚本每5分钟运行一次，这是Github定时任务允许的最短间隔。而DNSPod免费版的TTL最低为600秒，再频繁也没有意义。大部分时候IP并不会变化，脚本十几秒便能运行完毕。

需要注意的是，公开仓库如果60天没有提交，Github会自动停用定时任务。因此我在工作流的最后加了一步，每次运行时调用一次启用工作流的接口，以重置这一计时：

```yaml
- name: Keep the schedule alive
  if: ${{ always() }}
  run: gh api -X PUT "repos/$GITHUB_REPOSITORY/actions/workflows/dns-flatten.yml/enable"
  env:
    GH_TOKEN: ${{ github.token }}
```

## 根域名跳转至www

根域名的请求到达EdgeOne之后，交由Makers的中间件处理，路径和参数会一并保留：

```js
export function middleware({ request, redirect, next }) {
  const url = new URL(request.url);
  if (url.hostname === 'leekarl.com') {
    url.protocol = 'https:';
    url.hostname = 'www.leekarl.com';
    url.port = '';
    return redirect(url.toString(), 301);
  }
  if (url.pathname === '/middleware.js') {
    return new Response('Not Found', { status: 404 });
  }
  return next();
}
```

由于我是将构建好的`dist`目录直接上传的，`middleware.js`也会被作为静态文件一同上传，因此中间件中还额外让`/middleware.js`返回404，避免源码被直接访问。

部署步骤则加在原有的Github Pages工作流之后，一次构建，同时部署到两边：

```yaml
- name: Deploy to EdgeOne Makers
  run: |
    cp makers/middleware.js dist/
    npx --yes edgeone@1.7.2 makers deploy dist -n leekarl-homepage -t "$EDGEONE_API_TOKEN"
  env:
    EDGEONE_API_TOKEN: ${{ secrets.EDGEONE_API_TOKEN }}
```
