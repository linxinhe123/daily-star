<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { Activity, Archive, ArrowRight, Bookmark, CalendarDays, Check, ChevronRight, CircleHelp, Clock3, Database, ExternalLink, Flame, Footprints, Home, Info, Medal, MessageCircle, Search, Send, Share2, Sparkles, Target, Trophy, UserRound } from 'lucide-vue-next'
import { accepts, players, type Player } from './players'
import { getFootballAsset, playerData } from './player-data'
import MarketValueChart from './components/MarketValueChart.vue'
import PerformanceChart from './components/PerformanceChart.vue'

type Status = 'playing' | 'won' | 'revealed'
type View = 'today' | 'archive' | 'saved' | 'about'
type DetailTab = 'overview' | 'stats' | 'career' | 'honors' | 'ask'
const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
const seed = [...todayKey].reduce((sum, char) => sum + char.charCodeAt(0), 0)
const player = ref<Player>(players[seed % players.length]!)
const attempt = ref(0)
const status = ref<Status>('playing')
const guess = ref('')
const message = ref('')
const view = ref<View>('today')
const detailTab = ref<DetailTab>('overview')
const imageFailed = ref(false)
const question = ref('')
const chat = ref<{ role: 'user' | 'assistant'; text: string }[]>([])
const composer = ref<HTMLInputElement | null>(null)
const search = ref('')

const complete = computed(() => status.value !== 'playing')
const visibleClues = computed(() => player.value.clues.slice(0, Math.max(1, attempt.value + 1)))
const filteredPlayers = computed(() => players.filter(item => `${item.zh}${item.name}${item.nation}`.toLowerCase().includes(search.value.toLowerCase())))
const choices = computed(() => [...players.filter(item => item.slug !== player.value.slug).slice(seed % 6, seed % 6 + 3), player.value].sort((a, b) => (a.slug + todayKey).localeCompare(b.slug + todayKey)))
const detail = computed(() => playerData[player.value.slug])
const latestSeason = computed(() => detail.value?.seasons[detail.value.seasons.length - 1])
const failedAssets = ref(new Set<string>())
const detailTheme = computed(() => ({
  '--player-primary': detail.value?.theme.primary ?? '#181b20',
  '--player-secondary': detail.value?.theme.secondary ?? '#303640',
  '--player-accent': detail.value?.theme.accent ?? '#d8dde5',
}))

function save() { localStorage.setItem(`daily-star:${todayKey}`, JSON.stringify({ attempt: attempt.value, status: status.value })) }
function go(target: View) { view.value = target; window.scrollTo({ top: 0, behavior: 'smooth' }) }
function submit(value = guess.value) {
  if (!value.trim() || complete.value) return
  attempt.value++
  if (accepts(player.value, value)) { status.value = 'won'; message.value = '猜对了！你认出了今天的球星'; nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' })) }
  else message.value = attempt.value >= 3 ? '最后再想一想，或者从候选球员中选择。' : '还不是他，新线索已经解锁。'
  guess.value = ''; save(); nextTick(() => composer.value?.focus())
}
function reveal() { status.value = 'revealed'; message.value = '今日球星已经揭晓'; save(); nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' })) }
function resetDemo() { attempt.value = 0; status.value = 'playing'; message.value = ''; detailTab.value = 'overview'; save() }
function openPlayer(item: Player) { player.value = item; imageFailed.value = false; status.value = 'revealed'; message.value = '球星档案'; detailTab.value = 'overview'; go('today') }
function assetFailed(name: string) { failedAssets.value = new Set(failedAssets.value).add(name) }
async function sharePlayer() {
  if (navigator.share) await navigator.share({ title: `${player.value.zh}｜每日一星`, text: player.value.kicker, url: location.href })
  else await navigator.clipboard?.writeText(location.href)
}
function ask(value = question.value) {
  if (!value.trim()) return
  question.value = ''; chat.value.push({ role: 'user', text: value })
  const q = value.toLowerCase(); let answer = `${player.value.intro} 推荐从「${player.value.match}」开始了解他。`
  if (/荣誉|冠军/.test(q)) answer = `代表荣誉包括：${player.value.honors.join('、')}。`
  if (/身价|俱乐部|数据|进球|助攻/.test(q) && detail.value) answer = `${player.value.zh}目前效力于${detail.value.currentClub}，本站已整理近五个赛季表现、俱乐部履历和身价趋势，你可以在“数据”和“生涯”页查看。`
  if (/特点|技术|踢法/.test(q)) answer = `${player.value.kicker}。${player.value.intro}`
  chat.value.push({ role: 'assistant', text: `${answer}\n来源：本站球员档案。` })
}
onMounted(() => { const raw = localStorage.getItem(`daily-star:${todayKey}`); if (raw) try { const value = JSON.parse(raw); attempt.value = value.attempt || 0; status.value = value.status || 'playing' } catch {} })
</script>

<template>
  <div class="app-shell">
    <aside class="side-nav">
      <button class="logo" @click="go('today')"><span>星</span><strong>每日一星</strong></button>
      <div class="nav-list">
        <button :class="{active:view==='today'}" @click="go('today')"><Home/>今日挑战</button>
        <button :class="{active:view==='archive'}" @click="go('archive')"><Archive/>球星档案</button>
        <button :class="{active:view==='saved'}" @click="go('saved')"><Bookmark/>我的收藏</button>
        <button :class="{active:view==='about'}" @click="go('about')"><Info/>关于</button>
      </div>
      <div class="streak-card"><Flame/><div><strong>连续 7 天</strong><span>再坚持一天，解锁新徽章</span></div></div>
    </aside>

    <div class="app-main">
      <header class="app-header"><button class="mobile-logo" @click="go('today')"><span>星</span>每日一星</button><div class="header-date"><CalendarDays/>{{ todayKey }}</div><button class="avatar" aria-label="个人中心"><UserRound/></button></header>

      <main v-if="view==='today'" class="content">
        <template v-if="!complete">
          <section class="welcome"><div><span>你好，足球迷</span><h1>准备好今天的挑战了吗？</h1><p>根据逐步解锁的生涯线索，认出今天的神秘球星。</p></div><div class="daily-badge"><span>今日</span><strong>{{ seed % 365 + 1 }}</strong><small>/ 365</small></div></section>

          <div class="dashboard-grid">
            <section class="challenge-card">
              <div class="challenge-head"><div class="challenge-icon"><Target/></div><div><span>每日挑战</span><h2>猜猜他是谁？</h2></div><div class="attempts"><strong>{{ attempt + 1 }}</strong><span>/ 3 次</span></div></div>
              <div class="progress"><span :style="{width:`${Math.min((attempt+1)/3*100,100)}%`}"></span></div>
              <div class="clues">
                <article v-for="(clue,index) in player.clues" :key="clue" :class="{locked:index>=visibleClues.length}">
                  <span><Check v-if="index<visibleClues.length"/><strong v-else>{{ index+1 }}</strong></span>
                  <div><small>线索 {{ index+1 }}</small><p>{{ index<visibleClues.length ? clue : '猜错后解锁这条线索' }}</p></div>
                </article>
              </div>
              <p v-if="message" class="feedback">{{ message }}</p>
              <form class="answer-box" @submit.prevent="submit()"><Search/><input ref="composer" v-model="guess" placeholder="输入球员中文名或英文名" aria-label="输入球员名字"><button aria-label="提交答案"><ArrowRight/></button></form>
              <div v-if="attempt>=2" class="choice-grid"><button v-for="item in choices" :key="item.slug" @click="submit(item.zh)">{{ item.flag }} {{ item.zh }}</button></div>
              <button class="reveal-link" @click="reveal">不知道答案？直接揭晓</button>
            </section>

            <aside class="right-rail">
              <section class="mini-card rules"><div class="mini-title"><CircleHelp/><strong>挑战规则</strong></div><ul><li>每天北京时间 00:00 更新</li><li>前两次自由输入答案</li><li>第三次提供四个候选球员</li></ul></section>
              <section class="mini-card"><div class="mini-title"><Clock3/><strong>最近球星</strong><button @click="go('archive')">查看全部</button></div><button v-for="item in players.slice(0,3)" :key="item.slug" class="recent" @click="openPlayer(item)"><span>{{ item.flag }}</span><div><strong>{{ item.zh }}</strong><small>{{ item.position }}</small></div><ChevronRight/></button></section>
            </aside>
          </div>
        </template>

        <template v-else>
          <div class="player-detail" :style="detailTheme">
          <section class="player-hero">
            <div class="hero-photo" :class="{fallback:imageFailed}"><div class="photo-fallback"><span>DAILY STAR</span><strong>{{ player.number }}</strong><small>{{ player.nation }} · {{ player.position }}</small></div><img v-if="!imageFailed" :src="player.image" :alt="player.zh" @error="imageFailed=true"></div>
            <div class="hero-info"><span class="success-pill"><Sparkles/>{{ message }}</span><p>{{ player.flag }} {{ player.nation }} · {{ player.position }}</p><h1>{{ player.zh }}</h1><h2>{{ player.name }}</h2><blockquote>{{ player.kicker }}</blockquote><div v-if="detail" class="hero-metrics"><span class="metric-with-crest"><img :src="getFootballAsset(detail.currentClub)?.src" :alt="detail.currentClub"><i><small>现效力</small>{{ detail.currentClub }}</i></span><span class="metric-with-crest"><img :src="getFootballAsset(player.nation)?.src" :alt="player.nation"><i><small>国家队</small>{{ detail.caps }} 场 / {{ detail.nationalGoals }} 球</i></span><span><small>当前身价</small>{{ detail.currentValue }}</span></div><div class="hero-actions"><button @click="sharePlayer"><Share2/>分享</button><button @click="resetDemo">再玩一次</button></div></div>
          </section>

          <div class="detail-tabs"><button :class="{active:detailTab==='overview'}" @click="detailTab='overview'">概览</button><button :class="{active:detailTab==='stats'}" @click="detailTab='stats'">数据</button><button :class="{active:detailTab==='career'}" @click="detailTab='career'">生涯</button><button :class="{active:detailTab==='honors'}" @click="detailTab='honors'">荣誉</button><button :class="{active:detailTab==='ask'}" @click="detailTab='ask'">问球星</button></div>

          <section v-if="detailTab==='overview'" class="tab-panel overview-grid"><article class="about-card"><div class="section-title"><strong>关于 {{ player.zh }}</strong><span>球员档案</span></div><p>{{ player.intro }}</p><div class="stat-row"><div class="profile-identity"><img v-if="getFootballAsset(player.nation)" :src="getFootballAsset(player.nation)?.src" :alt="player.nation"><span><small>国家队</small><strong>{{ player.nation }}</strong></span></div><div><small>位置</small><strong>{{ player.position }}</strong></div><div><small>职业年代</small><strong>{{ player.years }}</strong></div><template v-if="detail"><div><small>出生日期</small><strong>{{ detail.birthDate }}</strong></div><div><small>身高</small><strong>{{ detail.height }}</strong></div><div><small>惯用脚</small><strong>{{ detail.foot }}</strong></div></template></div></article><div class="overview-side"><article><Medal/><div><small>代表荣誉</small><strong>{{ player.honors[0] }}</strong></div></article><article><Target/><div><small>推荐比赛</small><strong>{{ player.match }}</strong></div></article><article><Sparkles/><div><small>冷知识</small><strong>{{ player.fact }}</strong></div></article></div></section>

          <section v-else-if="detailTab==='stats'" class="tab-panel data-panel">
            <template v-if="detail"><div class="section-title"><div><small class="eyebrow">PERFORMANCE</small><strong>赛季表现</strong></div><span>各项赛事 · 最近五季</span></div><div class="data-kpis"><article><Activity/><span><small>最近赛季出场</small><strong>{{ latestSeason?.appearances }}</strong></span></article><article><Target/><span><small>最近赛季进球</small><strong>{{ latestSeason?.goals }}</strong></span></article><article><Footprints/><span><small>最近赛季助攻</small><strong>{{ latestSeason?.assists }}</strong></span></article></div><PerformanceChart :stats="detail.seasons"/><p class="data-note"><Database/>图表按各项赛事口径整理，数据来源见页面底部。</p></template>
            <div v-else class="data-empty"><Database/><h2>详细数据整理中</h2><p>该球员尚未完成交叉核验，因此暂不展示进球、助攻或身价图表。</p></div>
          </section>

          <section v-else-if="detailTab==='career'" class="career-sections">
            <template v-if="detail"><article class="tab-panel market-section"><div class="section-title"><div><small class="eyebrow">MARKET VALUE</small><strong>身价变化</strong></div><span>单位：百万欧元</span></div><MarketValueChart :points="detail.marketValues"/><div class="club-key"><span v-for="club in [...new Set(detail.marketValues.map(item=>item.club))]" :key="club"><img v-if="getFootballAsset(club) && !failedAssets.has(club)" :src="getFootballAsset(club)?.src" :alt="club" @error="assetFailed(club)">{{ club }}</span></div></article><article class="tab-panel club-history"><div class="section-title"><div><small class="eyebrow">CLUB JOURNEY</small><strong>效力俱乐部</strong></div><span>{{ detail.clubs.length }} 段履历</span></div><div class="club-row" v-for="spell in detail.clubs" :key="spell.club+spell.period"><span class="club-mark"><img v-if="getFootballAsset(spell.club) && !failedAssets.has(spell.club)" :src="getFootballAsset(spell.club)?.src" :alt="spell.club" @error="assetFailed(spell.club)"><b v-else>{{ getFootballAsset(spell.club)?.short ?? spell.club.slice(0,1) }}</b></span><div><strong>{{ spell.club }}</strong><small>{{ spell.period }}<template v-if="spell.note"> · {{ spell.note }}</template></small></div><dl v-if="spell.appearances !== undefined"><div><dt>出场</dt><dd>{{ spell.appearances }}</dd></div><div><dt>进球</dt><dd>{{ spell.goals }}</dd></div></dl></div></article></template>
            <article v-else class="tab-panel career-list"><div class="section-title"><strong>生涯关键节点</strong><span>详细俱乐部数据整理中</span></div><article v-for="item in player.timeline" :key="item.year+item.title"><time>{{ item.year }}</time><span></span><div><h3>{{ item.title }}</h3><p>{{ item.text }}</p></div></article></article>
          </section>

          <section v-else-if="detailTab==='honors'" class="honors-panel">
            <template v-if="detail"><article v-for="group in detail.honorGroups" :key="group.category" class="tab-panel honor-group"><header><div><small class="eyebrow">HONOURS</small><h2>{{ group.category }}</h2></div><strong>{{ group.total }}<small>项 / 次</small></strong></header><div class="honor-list"><div v-for="honor in group.items" :key="honor.title"><span :class="['honor-visual',getFootballAsset(honor.title)?.kind]"><img v-if="getFootballAsset(honor.title) && !failedAssets.has(honor.title)" :src="getFootballAsset(honor.title)?.src" :alt="honor.title" @error="assetFailed(honor.title)"><b v-else>{{ getFootballAsset(honor.title)?.short ?? '奖' }}</b></span><span><strong>{{ honor.title }}</strong><small>{{ honor.years }}</small></span><b>×{{ honor.count }}</b></div></div></article></template>
            <article v-else class="tab-panel honor-grid"><article v-for="honor in player.honors" :key="honor"><Trophy/><strong>{{ honor }}</strong><span>代表荣誉 · 完整年份待核验</span></article></article>
          </section>
          <section v-else class="tab-panel chat-panel"><div class="section-title"><strong>球星追问室</strong><span>回答基于本站档案</span></div><div class="quick-asks"><button @click="ask('他的技术特点是什么？')">技术特点</button><button @click="ask('他有哪些代表荣誉？')">代表荣誉</button></div><div class="chat-log"><div v-if="!chat.length" class="chat-empty"><MessageCircle/><p>问问他的技术特点、生涯故事或经典比赛。</p></div><div v-for="(item,index) in chat" :key="index" :class="['bubble',item.role]">{{ item.text }}</div></div><form @submit.prevent="ask()"><input v-model="question" placeholder="输入你的问题"><button aria-label="发送"><Send/></button></form></section>
          <div class="source-row"><a class="photo-credit" :href="player.image" target="_blank">图片：{{ player.credit }} <ExternalLink/></a><template v-if="detail"><a v-for="source in detail.sources" :key="source.url" :href="source.url" target="_blank">{{ source.label }}<ExternalLink/></a></template></div>
          </div>
        </template>
      </main>

      <main v-else-if="view==='archive'" class="content archive-page"><section class="page-heading"><div><span>球星档案</span><h1>认识每一位传奇</h1><p>从历史巨星到现役核心，浏览完整生涯档案。</p></div><div class="search-box"><Search/><input v-model="search" placeholder="搜索球员、国家或位置"></div></section><div class="player-grid"><button v-for="item in filteredPlayers" :key="item.slug" @click="openPlayer(item)"><div class="player-tile"><span>{{ item.flag }}</span><strong>{{ item.number }}</strong></div><div><small>{{ item.position }}</small><h2>{{ item.zh }}</h2><p>{{ item.name }}</p></div><ChevronRight/></button></div></main>
      <main v-else-if="view==='saved'" class="content empty-page"><Bookmark/><h1>我的收藏</h1><p>收藏喜欢的球星后，可以在这里快速找到他们。</p><button @click="go('archive')">浏览球星档案</button></main>
      <main v-else class="content about-page"><section class="page-heading"><div><span>关于每日一星</span><h1>每天认识一位球星</h1><p>用一场轻量竞猜开始，再通过可靠资料深入他的职业生涯。</p></div></section><div class="about-grid"><article><Target/><h2>内容原则</h2><p>生涯节点和荣誉优先参考可靠体育组织、俱乐部与统计资料。</p></article><article><MessageCircle/><h2>AI 边界</h2><p>当前回答来自本地档案；不确定的信息会明确说明，不虚构事实。</p></article><article><Info/><h2>图片授权</h2><p>球员图片来自 Wikimedia Commons，卡片保留原始来源入口。</p></article></div></main>
    </div>

    <nav class="bottom-nav"><button :class="{active:view==='today'}" @click="go('today')"><Home/><span>今日</span></button><button :class="{active:view==='archive'}" @click="go('archive')"><Archive/><span>档案</span></button><button :class="{active:view==='saved'}" @click="go('saved')"><Bookmark/><span>收藏</span></button><button :class="{active:view==='about'}" @click="go('about')"><Info/><span>关于</span></button></nav>
  </div>
</template>
