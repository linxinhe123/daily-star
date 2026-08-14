import generatedStatbunkerRosterStats from './generated/statbunker-roster-stats.json'
import generatedPlayerIdentities from './generated/player-identities.json'
import { formatClubName } from './club-names'
import { buildFeaturedBiographySupplement, buildPlayerBiography, formatNationName } from './player-biography'

export type Player = {
  slug: string
  name: string
  zh: string
  aliases: string[]
  nation: string
  flag: string
  position: string
  years: string
  number: number
  kicker: string
  intro: string
  clues: string[]
  timeline: { year: string; title: string; text: string }[]
  honors: string[]
  match: string
  fact: string
  image: string
  credit: string
}

const commons = (file: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1000`

export const featuredPlayers: Player[] = [
  {
    slug: 'lionel-messi', name: 'Lionel Messi', zh: '梅西', aliases: ['里奥梅西', '莱昂内尔梅西', 'messi'], nation: '阿根廷', flag: '🇦🇷', position: '右边锋 / 前腰', years: '2004—至今', number: 10,
    kicker: '把足球变成贴着左脚运行的艺术', intro: '从拉玛西亚的瘦小少年，到带领阿根廷登上世界之巅。梅西以极低重心的连续触球、穿透防线的传球和冷静终结，重新定义了现代进攻核心。',
    clues: ['我出生在南美，却在欧洲完成青训。', '我的职业生涯与 10 号球衣紧密相连。', '我曾在同一家俱乐部赢得四次欧冠。', '我的惯用脚是左脚，以低重心盘带闻名。', '2022 年，我举起了此前唯一缺少的重要奖杯。'],
    timeline: [{ year: '2004', title: '巴萨一线队首秀', text: '17 岁完成正式比赛首秀。' }, { year: '2009', title: '首夺金球奖', text: '三冠王赛季成为世界最佳。' }, { year: '2012', title: '年度 91 球', text: '刷新自然年进球纪录。' }, { year: '2021', title: '美洲杯登顶', text: '赢得成年国家队首座大赛冠军。' }, { year: '2022', title: '加冕世界杯', text: '在卡塔尔完成国家队生涯巅峰。' }],
    honors: ['世界杯冠军', '8× 金球奖', '4× 欧冠冠军', '美洲杯冠军'], match: '2022 世界杯决赛 · 阿根廷 vs 法国', fact: '他在巴塞罗那正式比赛打入 672 球，是单一俱乐部进球纪录保持者。', image: commons('Lionel-Messi-Argentina-2022-FIFA-World-Cup.jpg'), credit: 'Wikimedia Commons · CC licensed'
  },
  { slug:'cristiano-ronaldo', name:'Cristiano Ronaldo', zh:'C 罗', aliases:['c罗纳尔多','克里斯蒂亚诺罗纳尔多','ronaldo','cr7'], nation:'葡萄牙', flag:'🇵🇹', position:'左边锋 / 中锋', years:'2002—至今', number:7, kicker:'用极致自律不断改写进球边界', intro:'从马德拉岛走出的边锋，逐渐进化为足球史上最高产的终结者之一。爆发力、头球、无球跑位与长期稳定性构成了他的标志。', clues:['我来自欧洲伊比利亚半岛。','7 号是我最具辨识度的号码。','我在英格兰、西班牙和意大利都赢得过联赛冠军。','我以弹跳、头球和逆足终结闻名。','我是葡萄牙国家队历史上的代表人物。'], timeline:[{year:'2003',title:'登陆曼联',text:'从葡萄牙体育加盟英超。'},{year:'2008',title:'首夺金球',text:'帮助曼联赢得欧冠。'},{year:'2009',title:'转会皇马',text:'开启队史最高产阶段。'},{year:'2016',title:'欧洲杯冠军',text:'葡萄牙首夺欧洲杯。'},{year:'2018',title:'转战意甲',text:'加盟尤文图斯。'}], honors:['5× 金球奖','5× 欧冠冠军','欧洲杯冠军','欧国联冠军'], match:'2018 欧冠 · 皇家马德里 vs 尤文图斯', fact:'他的职业生涯正式比赛进球跨越了多个时代。', image:commons('Cristiano Ronaldo 2018.jpg'), credit:'Wikimedia Commons · CC BY-SA' },
  { slug:'kaka',name:'Kaká',zh:'卡卡',aliases:['里卡多卡卡','kaka'],nation:'巴西',flag:'🇧🇷',position:'前腰',years:'2001—2017',number:22,kicker:'大步流星穿越中场的最后一位古典巨星',intro:'卡卡的推进看似舒展，却能以极高速度直插防线。2007 年，他以欧冠淘汰赛的统治表现赢得金球奖。',clues:['我来自巴西圣保罗。','我的昵称来自弟弟的发音。','我常身穿 22 号。','我的高速长距离推进极具辨识度。','我是梅罗时代前最后一位金球奖得主。'],timeline:[{year:'2001',title:'圣保罗首秀',text:'开启职业生涯。'},{year:'2002',title:'世界杯冠军',text:'入选巴西冠军阵容。'},{year:'2003',title:'加盟米兰',text:'迅速成为进攻核心。'},{year:'2007',title:'欧洲之巅',text:'欧冠冠军并赢得金球。'},{year:'2009',title:'转会皇马',text:'以高额转会费加盟。'}],honors:['世界杯冠军','金球奖','欧冠冠军','意甲冠军'],match:'2007 欧冠半决赛 · 曼联 vs AC 米兰',fact:'2007 年欧冠他以 10 球成为赛事最佳射手。',image:commons('Kaka061115.jpg'),credit:'Wikimedia Commons · CC licensed'},
  { slug:'andres-iniesta',name:'Andrés Iniesta',zh:'伊涅斯塔',aliases:['安德烈斯伊涅斯塔','小白','iniesta'],nation:'西班牙',flag:'🇪🇸',position:'中前卫 / 前腰',years:'2002—2024',number:8,kicker:'在密集防守中找到不存在的出口',intro:'伊涅斯塔的摆脱、半转身和最后一传总在最关键的瞬间出现。2010 年世界杯决赛的进球让他永远属于西班牙足球史。',clues:['我来自西班牙小镇。','我出自拉玛西亚。','人们因我的肤色给我一个中文昵称。','我擅长油炸丸子式摆脱。','我打入世界杯决赛制胜球。'],timeline:[{year:'2002',title:'巴萨首秀',text:'进入一线队。'},{year:'2006',title:'首夺欧冠',text:'逐渐成为主力。'},{year:'2009',title:'斯坦福桥绝杀',text:'帮助球队晋级欧冠决赛。'},{year:'2010',title:'世界杯制胜球',text:'加时绝杀荷兰。'},{year:'2018',title:'告别巴萨',text:'转战日本联赛。'}],honors:['世界杯冠军','2× 欧洲杯冠军','4× 欧冠冠军'],match:'2010 世界杯决赛 · 西班牙 vs 荷兰',fact:'他的世界杯决赛进球献给已故好友达尼·哈尔克。',image:commons('Andrés Iniesta 2018.jpg'),credit:'Wikimedia Commons · CC BY-SA'},
  { slug:'gianluigi-buffon',name:'Gianluigi Buffon',zh:'布冯',aliases:['吉安路易吉布冯','buffon'],nation:'意大利',flag:'🇮🇹',position:'门将',years:'1995—2023',number:1,kicker:'二十八年站在门线前保持热爱',intro:'反应、站位、指挥与惊人的稳定性让布冯成为门将位置的时代标杆。他经历巅峰、降级与重返顶级，忠诚同样定义了他。',clues:['我是一名意大利门将。','我在 17 岁完成意甲首秀。','我的姓氏中文听起来很有福气。','我随俱乐部经历过降级。','我赢得 2006 年世界杯。'],timeline:[{year:'1995',title:'帕尔马首秀',text:'零封强大的 AC 米兰。'},{year:'1999',title:'联盟杯冠军',text:'随帕尔马夺冠。'},{year:'2001',title:'加盟尤文',text:'创造门将转会纪录。'},{year:'2006',title:'世界杯冠军',text:'赛事仅失两球。'},{year:'2023',title:'宣布退役',text:'结束 28 年职业生涯。'}],honors:['世界杯冠军','10× 意甲冠军','联盟杯冠军'],match:'2006 世界杯半决赛 · 德国 vs 意大利',fact:'他曾在尤文降入意乙后选择留队。',image:commons('Gianluigi Buffon (31784615942).jpg'),credit:'Wikimedia Commons · CC BY'},
  { slug:'manuel-neuer',name:'Manuel Neuer',zh:'诺伊尔',aliases:['曼努埃尔诺伊尔','neuer'],nation:'德国',flag:'🇩🇪',position:'门将',years:'2005—至今',number:1,kicker:'把门将活动范围扩展到整片后场',intro:'诺伊尔不仅扑救，更以出击、传球和高位覆盖成为进攻体系的一部分。“门卫”并非由他发明，却由他推向主流。',clues:['我来自德国。','我最早在鲁尔区成名。','我是一名经常冲出禁区的门将。','我长期效力拜仁慕尼黑。','2014 世界杯让我定义门卫踢法。'],timeline:[{year:'2006',title:'沙尔克首秀',text:'进入德甲赛场。'},{year:'2011',title:'加盟拜仁',text:'接过豪门一号球衣。'},{year:'2013',title:'三冠王',text:'赢得首座欧冠。'},{year:'2014',title:'世界杯冠军',text:'获得金手套奖。'},{year:'2020',title:'再夺三冠',text:'队长身份登顶欧洲。'}],honors:['世界杯冠军','2× 欧冠冠军','11× 德甲冠军'],match:'2014 世界杯 · 德国 vs 阿尔及利亚',fact:'他在高位防线身后承担的覆盖工作改变了门将评价标准。',image:commons('Manuel Neuer 8158.jpg'),credit:'Wikimedia Commons · CC BY-SA'},
  { slug:'luka-modric',name:'Luka Modrić',zh:'莫德里奇',aliases:['卢卡莫德里奇','魔笛','modric'],nation:'克罗地亚',flag:'🇭🇷',position:'中前卫',years:'2003—至今',number:10,kicker:'用外脚背和韧性让小国走到世界中央',intro:'莫德里奇以摆脱、调度、覆盖和外脚背传球连接比赛。他带领克罗地亚闯入世界杯决赛，也打破了梅罗对金球奖的长期垄断。',clues:['我来自巴尔干半岛。','童年经历过战争。','我身材不高却能覆盖整个中场。','外脚背传球是我的标志。','我在 2018 年赢得金球奖。'],timeline:[{year:'2003',title:'萨格勒布起步',text:'外租经历磨练身体。'},{year:'2008',title:'登陆热刺',text:'适应英超节奏。'},{year:'2012',title:'加盟皇马',text:'成为欧冠王朝核心。'},{year:'2018',title:'世界杯亚军',text:'赢得赛事金球奖。'},{year:'2018',title:'世界最佳',text:'赢得个人金球奖。'}],honors:['金球奖','6× 欧冠冠军','世界杯亚军'],match:'2018 世界杯半决赛 · 克罗地亚 vs 英格兰',fact:'他在 2018 年包揽世界杯金球奖、世界足球先生和金球奖。',image:'/assets/football/luka-modric.png',credit:'TheSportsDB · player cutout'},
  { slug:'mohamed-salah',name:'Mohamed Salah',zh:'萨拉赫',aliases:['穆罕默德萨拉赫','埃及梅西','salah'],nation:'埃及',flag:'🇪🇬',position:'右边锋',years:'2010—至今',number:11,kicker:'从尼罗河畔跑入英超纪录册',intro:'萨拉赫从切尔西失意离开后，在意甲重建信心，最终成为利物浦的高速进球核心，也是阿拉伯世界最具影响力的运动员之一。',clues:['我来自非洲。','我通常从右路内切使用左脚。','我在英格兰第一次尝试并不成功。','我在罗马重获认可。','我身穿利物浦 11 号。'],timeline:[{year:'2010',title:'埃及联赛首秀',text:'阿拉伯承包商起步。'},{year:'2012',title:'登陆巴塞尔',text:'进入欧洲赛场。'},{year:'2015',title:'意甲重生',text:'佛罗伦萨与罗马时期成长。'},{year:'2017',title:'加盟利物浦',text:'首季刷新英超进球纪录。'},{year:'2019',title:'欧冠冠军',text:'决赛点球首开纪录。'}],honors:['欧冠冠军','2× 英超冠军','3× 英超金靴'],match:'2018 英超 · 利物浦 vs 沃特福德',fact:'他首个利物浦赛季打入 44 球，其中英超 32 球。',image:commons('Mohamed Salah 2018.jpg'),credit:'Wikimedia Commons · CC BY-SA'},
  { slug:'kylian-mbappe',name:'Kylian Mbappé',zh:'姆巴佩',aliases:['基利安姆巴佩','mbappe'],nation:'法国',flag:'🇫🇷',position:'中锋 / 左边锋',years:'2015—至今',number:10,kicker:'把防线身后的每一米变成危险',intro:'爆发启动、无球前插和高效终结使姆巴佩很早就站上世界舞台。他在两届世界杯决赛中打入四球，仍在书写上限。',clues:['我出生在巴黎郊区。','我的父亲是足球教练。','速度是我的第一标签。','我未满 20 岁便赢得世界杯。','我在一场世界杯决赛上演帽子戏法。'],timeline:[{year:'2015',title:'摩纳哥首秀',text:'刷新俱乐部最年轻纪录。'},{year:'2017',title:'欧冠突破',text:'帮助摩纳哥打入四强。'},{year:'2018',title:'世界杯冠军',text:'决赛进球。'},{year:'2022',title:'决赛帽子戏法',text:'赢得世界杯金靴。'},{year:'2024',title:'加盟皇马',text:'开启西甲生涯。'}],honors:['世界杯冠军','世界杯金靴','多次法甲冠军'],match:'2022 世界杯决赛 · 阿根廷 vs 法国',fact:'他是继赫斯特之后第二位在男足世界杯决赛戴帽的球员。',image:commons('Kylian Mbappé 2019.jpg'),credit:'Wikimedia Commons · CC BY'},
]

type DatabasePlayerRecord = {
  name?: string
  position?: string
  lastSeason?: number
  seasons: { season: string; club: string; playerName?: string; appearances?: number; goals?: number }[]
  clubTotals: { club: string; appearances?: number; goals?: number }[]
}

type DatabasePlayerIdentity = {
  name?: string
  zh?: string
  nation?: string
  flag?: string
  position?: string
  currentClub?: string
  number?: number | null
  active?: boolean
  image?: string
  imageCredit?: string
  traits?: string[]
  birthDate?: string
  height?: string
  foot?: string
  descriptionEn?: string
}

const databasePosition: Record<string, string> = {
  Attack: '前锋',
  Midfield: '中场',
  Defender: '后卫',
  Goalkeeper: '门将',
}

const nationalityCorrections: Record<string, { nation: string; flag: string }> = {
  'virgil-van-dijk': { nation: '荷兰', flag: '🇳🇱' },
  'frenkie-de-jong': { nation: '荷兰', flag: '🇳🇱' },
  'ryan-gravenberch': { nation: '荷兰', flag: '🇳🇱' },
  'xavi-simons': { nation: '荷兰', flag: '🇳🇱' },
  'matthijs-de-ligt': { nation: '荷兰', flag: '🇳🇱' },
  'jurrien-timber': { nation: '荷兰', flag: '🇳🇱' },
  'cody-gakpo': { nation: '荷兰', flag: '🇳🇱' },
  'tijjani-reijnders': { nation: '荷兰', flag: '🇳🇱' },
  gavi: { nation: '西班牙', flag: '🇪🇸' },
  antony: { nation: '巴西', flag: '🇧🇷' },
  'miralem-pjanic': { nation: '波斯尼亚和黑塞哥维那', flag: '🇧🇦' },
}

const databasePlayers = Object.entries(generatedStatbunkerRosterStats.players as Record<string, DatabasePlayerRecord>).map(([slug, record]): Player => {
  const identity = (generatedPlayerIdentities.players as Record<string, DatabasePlayerIdentity>)[slug]
  const name = record.name ?? record.seasons[0]?.playerName ?? slug.replace(/-/g, ' ')
  const firstSeason = record.seasons[0]?.season ?? '未知'
  const lastSeason = record.seasons[record.seasons.length - 1]?.season ?? firstSeason
  const identityClub = identity?.currentClub || ''
  const retired = identityClub === '_Retired Soccer' && (record.lastSeason ?? 0) < 2025
  const active = !retired && (Boolean(identityClub && identityClub !== '_Free Agent Soccer') || (record.lastSeason ?? 0) >= 2025 || identity?.active === true)
  const appearances = record.seasons.reduce((sum, season) => sum + ((season as { appearances?: number }).appearances ?? 0), 0)
  const goals = record.seasons.reduce((sum, season) => sum + ((season as { goals?: number }).goals ?? 0), 0)
  const currentClub = active && !['_Retired Soccer', '_Free Agent Soccer'].includes(identityClub) ? identityClub || record.seasons[record.seasons.length - 1]?.club || '' : ''
  const currentClubLabel = formatClubName(currentClub)
  const nationality = nationalityCorrections[slug]
  const nation = nationality?.nation ?? formatNationName(identity?.nation)
  const position = identity?.position || databasePosition[record.position ?? ''] || '职业球员'
  return {
    slug,
    name,
    zh: identity?.zh || name,
    aliases: [name, identity?.zh || ''].filter(Boolean),
    nation,
    flag: nationality?.flag ?? (identity?.flag || '⚽'),
    position,
    years: active ? `${firstSeason}—至今` : `${firstSeason}—${lastSeason}`,
    number: identity?.number ?? 0,
    kicker: identity?.traits?.length ? `${nation}${position}，以${identity.traits.join('、')}见长` : currentClub ? `${nation}${position}，现效力于${currentClubLabel}` : `${nation}${position}的俱乐部生涯档案`,
    intro: buildPlayerBiography(identity ? { ...identity, nation } : identity, record),
    clues: [],
    timeline: record.clubTotals.map(({ club }) => ({ year: '', title: club, text: '俱乐部生涯数据已收录' })),
    honors: [],
    match: currentClub ? `查看 ${currentClubLabel} 最新赛季表现` : '查看完整赛季表现',
    fact: `目前档案共覆盖 ${appearances} 次俱乐部出场和 ${goals} 粒进球。`,
    image: identity?.image || '',
    credit: identity?.imageCredit || '当前俱乐部视觉封面',
  }
})

const databasePlayerBySlug = new Map(databasePlayers.map((player) => [player.slug, player]))
featuredPlayers.forEach((player) => {
  const record = (generatedStatbunkerRosterStats.players as Record<string, DatabasePlayerRecord>)[player.slug]
  const identity = (generatedPlayerIdentities.players as Record<string, DatabasePlayerIdentity>)[player.slug]
  if (record && identity && databasePlayerBySlug.has(player.slug)) {
    player.intro += buildFeaturedBiographySupplement(identity, record)
    const normalizeIdentity = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase()
    if (identity.image && normalizeIdentity(identity.name) === normalizeIdentity(player.name)) {
      player.image = identity.image
      player.credit = identity.imageCredit || player.credit
    }
  }
})

const featuredSlugs = new Set(featuredPlayers.map((player) => player.slug))
export const players: Player[] = [...featuredPlayers, ...databasePlayers.filter((player) => !featuredSlugs.has(player.slug))]

export const normalize = (value: string) => value.toLowerCase().replace(/[\s·.\-_']/g, '')
export const accepts = (player: Player, input: string) => [player.zh, player.name, ...player.aliases].some(name => normalize(name) === normalize(input))
