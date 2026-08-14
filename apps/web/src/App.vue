<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Activity, Archive, ArrowRight, Bookmark, CalendarDays, Check, ChevronRight, CircleHelp, Clock3, Database, ExternalLink, Flame, Footprints, Home, Info, Medal, MessageCircle, Search, Send, Share2, Sparkles, Target, Trophy, UserRound } from 'lucide-vue-next'
import { accepts, featuredPlayers, players, type Player } from './players'
import { getFootballAsset, getVerifiedSeasonStats, playerData } from './player-data'
import { createRandomGame, loadGameSession, loadGameStats, saveGameSession, saveGameStats, type GameSession } from './game-session'
import { parseLocation, playerUrl, pushNavigation, type NavigationView } from './navigation'
import { loadFavoriteSlugs, toggleFavoriteSlug } from './favorites'
import MarketValueChart from './components/MarketValueChart.vue'
import PerformanceChart from './components/PerformanceChart.vue'
import NationalTeamMark from './components/NationalTeamMark.vue'
import { formatClubName } from './club-names'

type View = NavigationView
type DetailTab = 'overview' | 'stats' | 'career' | 'honors' | 'ask'
const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
const gameSession = ref<GameSession>(loadGameSession(players))
const gameStats = ref(loadGameStats())
const challengePlayer = computed(() => players.find((item) => item.slug === gameSession.value.playerSlug) ?? featuredPlayers[0]!)
const player = ref<Player>(challengePlayer.value)
const attempt = computed(() => gameSession.value.attempt)
const status = computed(() => gameSession.value.status)
const message = computed(() => gameSession.value.message)
const guess = ref('')
const view = ref<View>('today')
const detailTab = ref<DetailTab>('overview')
const detailMode = ref(false)
const imageFailed = ref(false)
const question = ref('')
const chat = ref<{ role: 'user' | 'assistant'; text: string }[]>([])
const composer = ref<HTMLInputElement | null>(null)
const search = ref('')
const failedArchiveImages = ref(new Set<string>())
const favoriteSlugs = ref(loadFavoriteSlugs())

const complete = computed(() => status.value !== 'playing')
const showingDetail = computed(() => detailMode.value || complete.value)
const visibleClues = computed(() => gameSession.value.clues.slice(0, Math.max(1, attempt.value + 1)))
const filteredPlayers = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return players
  return players.filter((item) => {
    const careerClubs = playerData[item.slug]?.clubs.flatMap((spell) => [spell.club, formatClubName(spell.club)]) ?? []
    const timelineClubs = item.timeline.flatMap((row) => [row.title, formatClubName(row.title)])
    return [item.zh, item.name, ...item.aliases, item.nation, item.position, ...careerClubs, ...timelineClubs].join(' ').toLowerCase().includes(query)
  })
})
const savedPlayers = computed(() => players.filter((item) => favoriteSlugs.value.has(item.slug)))
const isFavorite = computed(() => favoriteSlugs.value.has(player.value.slug))
const detail = computed(() => playerData[player.value.slug])
const verifiedStats = computed(() => getVerifiedSeasonStats(player.value.slug, detail.value?.seasons))
const hasHonors = computed(() => Boolean(detail.value?.honorGroups.length || player.value.honors.length))
const latestSeason = computed(() => verifiedStats.value.seasons[verifiedStats.value.seasons.length - 1])
const retired = computed(() => detail.value?.retired ?? !player.value.years.includes('至今'))
const careerTotal = computed(() => verifiedStats.value.seasons.reduce((total, row) => ({
  appearances: total.appearances + row.appearances,
  starts: total.starts + (row.starts ?? 0),
  goals: total.goals + row.goals,
  assists: total.assists + row.assists,
}), { appearances: 0, starts: 0, goals: 0, assists: 0 }))
const failedAssets = ref(new Set<string>())
const detailTheme = computed(() => ({
  '--player-primary': detail.value?.theme.primary ?? '#181b20',
  '--player-secondary': detail.value?.theme.secondary ?? '#303640',
  '--player-accent': detail.value?.theme.accent ?? '#d8dde5',
}))

function save() { saveGameSession(gameSession.value) }
function applyNavigation() {
  const state = parseLocation(players)
  view.value = state.view
  const selected = state.playerSlug ? players.find((item) => item.slug === state.playerSlug) : undefined
  detailMode.value = Boolean(selected)
  player.value = selected ?? challengePlayer.value
  imageFailed.value = false
  detailTab.value = 'overview'
}
function go(target: View) { view.value = target; detailMode.value = false; player.value = challengePlayer.value; pushNavigation({ view: target }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
function submit(value = guess.value) {
  if (!value.trim() || complete.value) return
  const nextAttempt = attempt.value + 1
  if (accepts(challengePlayer.value, value)) {
    gameSession.value = { ...gameSession.value, attempt: nextAttempt, status: 'won', message: '猜对了！你认出了这位球星' }
    gameStats.value = { played: gameStats.value.played + 1, won: gameStats.value.won + 1 }
    saveGameStats(gameStats.value)
    player.value = challengePlayer.value
    nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  } else if (nextAttempt >= 5) {
    gameSession.value = { ...gameSession.value, attempt: nextAttempt, status: 'revealed', message: '答案已揭晓' }
    gameStats.value = { ...gameStats.value, played: gameStats.value.played + 1 }
    saveGameStats(gameStats.value)
    player.value = challengePlayer.value
  } else gameSession.value = { ...gameSession.value, attempt: nextAttempt, message: '还不是他，新线索已经解锁。' }
  guess.value = ''; save(); nextTick(() => composer.value?.focus())
}
function reveal() { gameSession.value = { ...gameSession.value, status: 'revealed', message: '答案已揭晓' }; gameStats.value = { ...gameStats.value, played: gameStats.value.played + 1 }; saveGameStats(gameStats.value); player.value = challengePlayer.value; save(); nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' })) }
function resetDemo() { gameSession.value = createRandomGame(players, gameSession.value.playerSlug); player.value = challengePlayer.value; detailMode.value = false; view.value = 'today'; detailTab.value = 'overview'; imageFailed.value = false; pushNavigation({ view: 'today' }); save(); window.scrollTo({ top: 0, behavior: 'smooth' }) }
function openPlayer(item: Player) { player.value = item; imageFailed.value = false; detailMode.value = true; detailTab.value = 'overview'; view.value = 'today'; pushNavigation({ view: 'today', playerSlug: item.slug }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
function assetFailed(name: string) { failedAssets.value = new Set(failedAssets.value).add(name) }
function archiveImageFailed(slug: string) { failedArchiveImages.value = new Set(failedArchiveImages.value).add(slug) }
function toggleFavorite() { favoriteSlugs.value = toggleFavoriteSlug(favoriteSlugs.value, player.value.slug) }
async function sharePlayer() {
  const url = playerUrl(player.value.slug)
  if (navigator.share) {
    try {
      await navigator.share({ title: `${player.value.zh}｜猜球星`, text: player.value.kicker, url })
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }
  await navigator.clipboard?.writeText(url)
}
function ask(value = question.value) {
  if (!value.trim()) return
  question.value = ''; chat.value.push({ role: 'user', text: value })
  const q = value.toLowerCase(); let answer = `${player.value.intro} 推荐从「${player.value.match}」开始了解他。`
  if (/荣誉|冠军/.test(q)) {
    const honors = player.value.honors.length ? player.value.honors : detail.value?.honorGroups.flatMap((group) => group.items.map((item) => item.title)) ?? []
    answer = honors.length ? `代表荣誉包括：${honors.join('、')}。` : '本站暂未完成该球员荣誉信息的可靠核验，因此不展示未经确认的奖项。'
  }
  if (/身价|俱乐部|数据|进球|助攻/.test(q) && detail.value) {
    const statusText = detail.value.retired ? `${player.value.zh}已退役` : detail.value.currentClub ? `${player.value.zh}目前效力于${formatClubName(detail.value.currentClub)}` : `${player.value.zh}当前俱乐部待核验`
    const modules = [detail.value.clubs.length ? '俱乐部履历' : '', verifiedStats.value.seasons.length ? '赛季表现' : '', detail.value.marketValues.length ? '身价趋势' : ''].filter(Boolean)
    answer = `${statusText}。本站已整理${modules.join('、') || '基础档案'}${detail.value.marketValues.length ? '' : '；暂无可核验的身价曲线'}。`
  }
  if (/特点|技术|踢法/.test(q)) answer = `${player.value.kicker}。${player.value.intro}`
  chat.value.push({ role: 'assistant', text: `${answer}\n来源：本站球员档案。` })
}
onMounted(() => { save(); applyNavigation(); window.addEventListener('popstate', applyNavigation) })
onBeforeUnmount(() => window.removeEventListener('popstate', applyNavigation))
</script>

<template>
  <div class="app-shell">
    <aside class="side-nav">
      <button class="logo" @click="go('today')"><span>星</span><strong>猜球星</strong></button>
      <div class="nav-list">
        <button :class="{active:view==='today'}" @click="go('today')"><Home/>猜球星</button>
        <button :class="{active:view==='archive'}" @click="go('archive')"><Archive/>球星档案</button>
        <button :class="{active:view==='saved'}" @click="go('saved')"><Bookmark/>我的收藏</button>
        <button :class="{active:view==='about'}" @click="go('about')"><Info/>关于</button>
      </div>
      <div class="streak-card"><Flame/><div><strong>已猜对 {{ gameStats.won }} 位</strong><span>共完成 {{ gameStats.played }} 局</span></div></div>
    </aside>

    <div class="app-main">
      <header class="app-header"><button class="mobile-logo" @click="go('today')"><span>星</span>猜球星</button><div class="header-date"><CalendarDays/>{{ todayKey }}</div><button class="avatar" aria-label="个人中心"><UserRound/></button></header>

      <main v-if="view==='today'" class="content">
        <template v-if="!showingDetail">
          <section class="welcome"><div><span>无限挑战</span><h1>猜猜这位球星</h1><p>根据每局随机排列的生涯线索，尽可能早地找到答案。</p></div></section>

          <div class="dashboard-grid">
            <section class="challenge-card">
              <div class="challenge-head"><div class="challenge-icon"><Target/></div><div><span>本局挑战</span><h2>猜猜他是谁？</h2></div><div class="attempts"><strong>{{ Math.min(attempt + 1, 5) }}</strong><span>/ 5 次</span></div></div>
              <div class="progress"><span :style="{width:`${Math.min((attempt+1)/5*100,100)}%`}"></span></div>
              <div class="clues">
                <article v-for="(clue,index) in gameSession.clues" :key="clue" :class="{locked:index>=visibleClues.length}">
                  <span><Check v-if="index<visibleClues.length"/><strong v-else>{{ index+1 }}</strong></span>
                  <div><small>线索 {{ index+1 }}</small><p>{{ index<visibleClues.length ? clue : '猜错后解锁这条线索' }}</p></div>
                </article>
              </div>
              <p v-if="message" class="feedback">{{ message }}</p>
              <form class="answer-box" @submit.prevent="submit()"><Search/><input ref="composer" v-model="guess" placeholder="输入球员中文名或英文名" aria-label="输入球员名字"><button aria-label="提交答案"><ArrowRight/></button></form>
              <button class="reveal-link" @click="reveal">不知道答案？直接揭晓</button>
            </section>

            <aside class="right-rail">
              <section class="mini-card rules"><div class="mini-title"><CircleHelp/><strong>挑战规则</strong></div><ul><li>每局随机抽取一位球星</li><li>五条线索每局随机排列</li><li>猜错一次解锁一条线索</li></ul></section>
              <section class="mini-card"><div class="mini-title"><Clock3/><strong>最近球星</strong><button @click="go('archive')">查看全部</button></div><button v-for="item in featuredPlayers.slice(0,3)" :key="item.slug" class="recent" @click="openPlayer(item)"><span><NationalTeamMark :nation="item.nation" :label="false"/></span><div><strong>{{ item.zh }}</strong><small>{{ item.position }}</small></div><ChevronRight/></button></section>
            </aside>
          </div>
        </template>

        <template v-else>
          <div class="player-detail" :style="detailTheme">
          <section class="player-hero">
            <div class="hero-photo" :class="{fallback:imageFailed || !player.image,cutout:player.image.endsWith('.png')}"><div class="photo-fallback"><span v-if="detail?.currentClub && getFootballAsset(detail.currentClub)" class="fallback-club"><img :src="getFootballAsset(detail.currentClub)?.src" :alt="detail.currentClub"></span><span v-else class="fallback-name">{{ player.zh }}</span><strong v-if="player.number">{{ player.number }}</strong><small>{{ player.nation }} · {{ player.position }}</small></div><img v-if="!imageFailed && player.image" :src="player.image" :alt="player.zh" @error="imageFailed=true"></div>
            <div class="hero-info"><span class="success-pill"><Sparkles/>{{ detailMode ? '球星档案' : message }}</span><p><NationalTeamMark :nation="player.nation"/><span>· {{ player.position }}</span></p><h1>{{ player.zh }}</h1><h2>{{ player.name }}</h2><blockquote>{{ player.kicker }}</blockquote><div v-if="detail" class="hero-metrics"><span v-if="detail.retired"><small>职业状态</small>已退役</span><span v-else-if="detail.currentClub" class="metric-with-crest"><img v-if="getFootballAsset(detail.currentClub)" :src="getFootballAsset(detail.currentClub)?.src" :alt="detail.currentClub"><i><small>现效力</small>{{ formatClubName(detail.currentClub) }}</i></span><span v-if="detail.caps"><small>国家队</small>{{ detail.caps }} 场 / {{ detail.nationalGoals ?? 0 }} 球</span><span v-else><small>俱乐部履历</small>{{ detail.clubs.length }} 段</span><span v-if="detail.currentValue && !detail.retired"><small>当前身价</small>{{ detail.currentValue }}</span><span v-else-if="verifiedStats.seasons.length"><small>赛季记录</small>{{ verifiedStats.seasons.length }} 条</span></div><div class="hero-actions"><button @click="sharePlayer"><Share2/>分享</button><button @click="toggleFavorite"><Bookmark/>{{ isFavorite ? '已收藏' : '收藏' }}</button><button @click="resetDemo">再猜一位</button></div></div>
          </section>

          <div class="detail-tabs"><button :class="{active:detailTab==='overview'}" @click="detailTab='overview'">概览</button><button v-if="verifiedStats.seasons.length" :class="{active:detailTab==='stats'}" @click="detailTab='stats'">数据</button><button v-if="detail?.clubs.length || detail?.marketValues.length" :class="{active:detailTab==='career'}" @click="detailTab='career'">生涯</button><button v-if="hasHonors" :class="{active:detailTab==='honors'}" @click="detailTab='honors'">荣誉</button><button :class="{active:detailTab==='ask'}" @click="detailTab='ask'">问球星</button></div>

          <section v-if="detailTab==='overview'" class="tab-panel overview-grid"><article class="about-card"><div class="section-title"><strong>关于 {{ player.zh }}</strong><span>球员档案</span></div><p>{{ player.intro }}</p><div class="stat-row"><div class="profile-identity"><NationalTeamMark :nation="player.nation" :label="false"/><span><small>国家队</small><strong>{{ player.nation }}</strong></span></div><div><small>位置</small><strong>{{ player.position }}</strong></div><div><small>职业年代</small><strong>{{ player.years }}</strong></div><template v-if="detail"><div v-if="detail.retired"><small>职业状态</small><strong>已退役</strong></div><div v-else-if="detail.currentClub"><small>当前俱乐部</small><strong>{{ formatClubName(detail.currentClub) }}</strong></div><div v-if="detail.birthDate"><small>出生日期</small><strong>{{ detail.birthDate }}</strong></div><div v-if="detail.height"><small>身高</small><strong>{{ detail.height }}</strong></div><div v-if="detail.foot"><small>惯用脚</small><strong>{{ detail.foot }}</strong></div></template></div></article><div class="overview-side"><article v-if="player.honors.length"><Medal/><div><small>代表荣誉</small><strong>{{ player.honors[0] }}</strong></div></article><article><Target/><div><small>{{ retired ? '生涯回顾' : '当前关注' }}</small><strong>{{ player.match }}</strong></div></article><article><Sparkles/><div><small>生涯数据</small><strong>{{ player.fact }}</strong></div></article></div></section>

          <section v-else-if="detailTab==='stats'" class="tab-panel data-panel">
            <template v-if="verifiedStats.seasons.length"><div class="section-title"><div><small class="eyebrow">PERFORMANCE</small><strong>{{ retired ? '球队生涯总计' : '赛季表现' }}</strong></div><span>俱乐部联赛 + 已覆盖杯赛 · {{ retired ? '按球队汇总' : `${verifiedStats.seasons.length} 条真实记录` }}</span></div><div class="data-kpis"><article><Activity/><span><small>{{ retired ? '生涯出场' : '最近记录出场' }}</small><strong>{{ retired ? careerTotal.appearances : latestSeason?.appearances }}</strong></span></article><article><Target/><span><small>{{ retired ? '生涯进球' : '最近记录进球' }}</small><strong>{{ retired ? careerTotal.goals : latestSeason?.goals }}</strong></span></article><article><Footprints/><span><small>{{ retired ? '生涯助攻' : '最近记录助攻' }}</small><strong>{{ retired ? careerTotal.assists : latestSeason?.assists }}</strong></span></article></div><PerformanceChart :stats="verifiedStats.seasons" :aggregate-by-club="retired"/><p class="data-note"><Database/>数据源：Statbunker；统计已覆盖的俱乐部联赛与杯赛。暂不含国家队，Statbunker 未提供的国内杯赛不补零。</p></template>
            <div v-else class="data-empty"><Database/><h2>详细数据整理中</h2><p>该球员尚未完成交叉核验，因此暂不展示进球、助攻或身价图表。</p></div>
          </section>

          <section v-else-if="detailTab==='career'" class="career-sections">
            <template v-if="detail"><article v-if="detail.marketValues.length" class="tab-panel market-section"><div class="section-title"><div><small class="eyebrow">MARKET VALUE</small><strong>身价变化</strong></div><span>单位：百万欧元</span></div><MarketValueChart :points="detail.marketValues"/></article><article v-if="detail.clubs.length" class="tab-panel club-history"><div class="section-title"><div><small class="eyebrow">CLUB JOURNEY</small><strong>效力俱乐部</strong></div><span>{{ detail.clubs.length }} 段履历</span></div><div class="club-row" v-for="spell in detail.clubs" :key="spell.club+spell.period"><span class="club-mark"><img v-if="getFootballAsset(spell.club) && !failedAssets.has(spell.club)" :src="getFootballAsset(spell.club)?.src" :alt="spell.club" @error="assetFailed(spell.club)"><b v-else>{{ getFootballAsset(spell.club)?.short ?? spell.club.slice(0,1) }}</b></span><div><strong>{{ formatClubName(spell.club) }}</strong><small>{{ spell.period }}<template v-if="spell.note"> · {{ spell.note }}</template></small></div><dl v-if="spell.appearances !== undefined"><div><dt>出场</dt><dd>{{ spell.appearances }}</dd></div><div><dt>进球</dt><dd>{{ spell.goals }}</dd></div></dl></div></article></template>
            <article v-else class="tab-panel career-list"><div class="section-title"><strong>生涯关键节点</strong><span>详细俱乐部数据整理中</span></div><article v-for="item in player.timeline" :key="item.year+item.title"><time>{{ item.year }}</time><span></span><div><h3>{{ item.title }}</h3><p>{{ item.text }}</p></div></article></article>
          </section>

          <section v-else-if="detailTab==='honors'" class="honors-panel">
            <template v-if="detail"><article v-for="group in detail.honorGroups" :key="group.category" class="tab-panel honor-group"><header><div><small class="eyebrow">HONOURS</small><h2>{{ group.category }}</h2></div><strong>{{ group.total }}<small>项 / 次</small></strong></header><div class="honor-list"><div v-for="honor in group.items" :key="honor.title"><span :class="['honor-visual',getFootballAsset(honor.title)?.kind]"><img v-if="getFootballAsset(honor.title) && !failedAssets.has(honor.title)" :src="getFootballAsset(honor.title)?.src" :alt="honor.title" @error="assetFailed(honor.title)"><b v-else>{{ getFootballAsset(honor.title)?.short ?? '奖' }}</b></span><span><strong>{{ honor.title }}</strong><small>{{ honor.years }}</small></span><b>×{{ honor.count }}</b></div></div></article></template>
            <article v-else class="tab-panel honor-grid"><article v-for="honor in player.honors" :key="honor"><Trophy/><strong>{{ honor }}</strong><span>代表荣誉 · 完整年份待核验</span></article></article>
          </section>
          <section v-else class="tab-panel chat-panel"><div class="section-title"><strong>球星追问室</strong><span>回答基于本站档案</span></div><div class="quick-asks"><button @click="ask('他的技术特点是什么？')">技术特点</button><button @click="ask('他有哪些代表荣誉？')">代表荣誉</button></div><div class="chat-log"><div v-if="!chat.length" class="chat-empty"><MessageCircle/><p>问问他的技术特点、生涯故事或经典比赛。</p></div><div v-for="(item,index) in chat" :key="index" :class="['bubble',item.role]">{{ item.text }}</div></div><form @submit.prevent="ask()"><input v-model="question" placeholder="输入你的问题"><button aria-label="发送"><Send/></button></form></section>
          <div class="source-row"><a v-if="player.image" class="photo-credit" :href="player.image" target="_blank">图片：{{ player.credit }} <ExternalLink/></a><span v-else class="photo-credit">图片：{{ player.credit }}</span><template v-if="detail"><a v-for="source in detail.sources" :key="source.url" :href="source.url" target="_blank">{{ source.label }}<ExternalLink/></a></template></div>
          </div>
        </template>
      </main>

      <main v-else-if="view==='archive'" class="content archive-page"><section class="page-heading"><div><span>球星档案</span><h1>认识每一位传奇</h1><p>从历史巨星到现役核心，浏览完整生涯档案。</p></div><div class="search-box"><Search/><input v-model="search" placeholder="搜索球员、国家、位置或俱乐部"></div></section><div v-if="filteredPlayers.length" class="player-grid"><button v-for="item in filteredPlayers" :key="item.slug" @click="openPlayer(item)"><div class="player-tile" :class="{'has-photo':item.image && !failedArchiveImages.has(item.slug)}"><img v-if="item.image && !failedArchiveImages.has(item.slug)" :src="item.image" :alt="item.zh" @error="archiveImageFailed(item.slug)"><span v-else class="player-fallback"><b>{{ item.zh }}</b><NationalTeamMark :nation="item.nation" :label="false"/></span></div><div><div class="player-meta"><small>{{ item.position }}</small><NationalTeamMark :nation="item.nation"/></div><h2>{{ item.zh }}</h2><p>{{ item.name }}</p></div><ChevronRight/></button></div><section v-else class="archive-empty"><Search/><h2>未找到匹配球员</h2><p>试试其他姓名、国家、位置或俱乐部。</p><button @click="search=''">清空搜索</button></section></main>
      <main v-else-if="view==='saved'" class="content saved-page"><section class="page-heading"><div><span>个人收藏</span><h1>我的球星</h1><p>已收藏 {{ savedPlayers.length }} 位球员。</p></div></section><div v-if="savedPlayers.length" class="player-grid"><button v-for="item in savedPlayers" :key="item.slug" @click="openPlayer(item)"><div class="player-tile" :class="{'has-photo':item.image && !failedArchiveImages.has(item.slug)}"><img v-if="item.image && !failedArchiveImages.has(item.slug)" :src="item.image" :alt="item.zh" @error="archiveImageFailed(item.slug)"><span v-else class="player-fallback"><b>{{ item.zh }}</b><NationalTeamMark :nation="item.nation" :label="false"/></span></div><div><div class="player-meta"><small>{{ item.position }}</small><NationalTeamMark :nation="item.nation"/></div><h2>{{ item.zh }}</h2><p>{{ item.name }}</p></div><ChevronRight/></button></div><section v-else class="empty-page"><Bookmark/><h1>还没有收藏</h1><p>打开球员档案即可收藏喜欢的球星。</p><button @click="go('archive')">浏览球星档案</button></section></main>
      <main v-else class="content about-page"><section class="page-heading"><div><span>关于猜球星</span><h1>一局接一局地认识球星</h1><p>从随机线索开始，再通过可靠资料深入他的职业生涯。</p></div></section><div class="about-grid"><article><Target/><h2>内容原则</h2><p>生涯节点和荣誉优先参考可靠体育组织、俱乐部与统计资料。</p></article><article><MessageCircle/><h2>AI 边界</h2><p>当前回答来自本地档案；不确定的信息会明确说明，不虚构事实。</p></article><article><Info/><h2>图片授权</h2><p>球员图片优先使用已同步的本地资源，并保留原始来源入口。</p></article></div></main>
    </div>

    <nav class="bottom-nav"><button :class="{active:view==='today'}" @click="go('today')"><Home/><span>猜球</span></button><button :class="{active:view==='archive'}" @click="go('archive')"><Archive/><span>档案</span></button><button :class="{active:view==='saved'}" @click="go('saved')"><Bookmark/><span>收藏</span></button><button :class="{active:view==='about'}" @click="go('about')"><Info/><span>关于</span></button></nav>
  </div>
</template>
