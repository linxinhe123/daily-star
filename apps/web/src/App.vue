<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { ArrowRight, BookOpen, CalendarDays, Check, ChevronRight, CircleHelp, ExternalLink, Menu, MessageCircle, RotateCcw, Search, Send, Share2, Sparkles, Trophy, X } from 'lucide-vue-next'
import { accepts, players, type Player } from './players'

type Status = 'playing' | 'won' | 'revealed'
const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
const seed = [...todayKey].reduce((sum, char) => sum + char.charCodeAt(0), 0)
const player = ref<Player>(players[seed % players.length]!)
const attempt = ref(0)
const status = ref<Status>('playing')
const guess = ref('')
const message = ref('')
const view = ref<'today' | 'archive' | 'sources'>('today')
const mobileNav = ref(false)
const imageFailed = ref(false)
const question = ref('')
const chat = ref<{ role: 'user' | 'assistant'; text: string }[]>([])
const composer = ref<HTMLInputElement | null>(null)

const visibleClues = computed(() => player.value.clues.slice(0, Math.max(1, attempt.value + 1)))
const complete = computed(() => status.value !== 'playing')
const choices = computed(() => {
  const others = players.filter(item => item.slug !== player.value.slug).sort((a, b) => (a.slug + todayKey).localeCompare(b.slug + todayKey)).slice(0, 3)
  return [...others, player.value].sort((a, b) => (a.zh + todayKey).localeCompare(b.zh + todayKey))
})
const progressLabel = computed(() => complete.value ? (status.value === 'won' ? `第 ${attempt.value} 次猜中` : '已揭晓答案') : `${attempt.value + 1} / 3 次尝试`)

function save() {
  localStorage.setItem(`daily-star:${todayKey}`, JSON.stringify({ attempt: attempt.value, status: status.value }))
}
function submit(value = guess.value) {
  if (!value.trim() || complete.value) return
  attempt.value += 1
  if (accepts(player.value, value)) {
    status.value = 'won'
    message.value = '命中。今天的球星就是他。'
    nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  } else {
    message.value = attempt.value >= 3 ? '还差一点。试试下面的候选球员。' : '不是这位，新的线索已解锁。'
  }
  guess.value = ''
  save()
  nextTick(() => composer.value?.focus())
}
function reveal() {
  status.value = 'revealed'
  message.value = '答案已揭晓，本次不计猜中。'
  save()
  nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
}
function resetDemo() {
  attempt.value = 0; status.value = 'playing'; message.value = ''; guess.value = ''; save()
}
function ask() {
  const value = question.value.trim()
  if (!value) return
  chat.value.push({ role: 'user', text: value })
  const q = value.toLowerCase()
  let answer = `根据档案，${player.value.zh}${player.value.intro} 推荐从「${player.value.match}」开始看。`
  if (/荣誉|冠军|honor/.test(q)) answer = `${player.value.zh}的代表荣誉包括：${player.value.honors.join('、')}。`
  if (/特点|技术|踢法|厉害/.test(q)) answer = `${player.value.kicker}。${player.value.intro}`
  if (/比赛|录像|match/.test(q)) answer = `推荐观看：${player.value.match}。这场比赛最能帮助你理解他的比赛影响力。`
  chat.value.push({ role: 'assistant', text: `${answer}\n\n来源：本站球员档案与 Wikimedia Commons 署名资料。` })
  question.value = ''
}
function show(target: typeof view.value) { view.value = target; mobileNav.value = false; window.scrollTo({ top: 0, behavior: 'smooth' }) }

onMounted(() => {
  const stored = localStorage.getItem(`daily-star:${todayKey}`)
  if (stored) { try { const value = JSON.parse(stored); attempt.value = value.attempt || 0; status.value = value.status || 'playing' } catch {} }
})
</script>

<template>
  <header class="site-header">
    <button class="brand" @click="show('today')" aria-label="返回今日球星"><span class="brand-mark">星</span><span>每日一星</span></button>
    <nav :class="{ open: mobileNav }">
      <button :class="{ active: view === 'today' }" @click="show('today')">今日</button>
      <button :class="{ active: view === 'archive' }" @click="show('archive')">球星档案</button>
      <button :class="{ active: view === 'sources' }" @click="show('sources')">关于与来源</button>
    </nav>
    <div class="header-actions"><span class="edition">NO. {{ seed % 365 + 1 }} · {{ todayKey }}</span><button class="icon-button menu" @click="mobileNav = !mobileNav"><X v-if="mobileNav"/><Menu v-else/></button></div>
  </header>

  <main v-if="view === 'today'">
    <section v-if="!complete" class="guess-layout page-shell">
      <div class="editorial-intro">
        <p class="eyebrow"><span></span> DAILY FOOTBALL PORTRAIT</p>
        <h1>今天的球星<br>藏在线索里</h1>
        <p class="lead">五条生涯线索，三次判断机会。别搜答案，凭你对足球的记忆与直觉来认出他。</p>
        <div class="meta-row"><span><CalendarDays/> 北京时间每日 00:00 更新</span><span><CircleHelp/> 365 天内不重复</span></div>
      </div>

      <section class="clue-panel" aria-label="竞猜面板">
        <div class="panel-top"><div><span class="micro">PLAYER 01</span><h2>他是谁？</h2></div><span class="attempt-pill">{{ progressLabel }}</span></div>
        <ol class="clue-list">
          <li v-for="(clue, index) in player.clues" :key="clue" :class="{ locked: index >= visibleClues.length }">
            <span class="clue-number">0{{ index + 1 }}</span>
            <p v-if="index < visibleClues.length">{{ clue }}</p><p v-else>猜错后解锁下一条线索</p>
            <Check v-if="index < visibleClues.length" />
          </li>
        </ol>
        <p v-if="message" class="feedback">{{ message }}</p>
        <form class="guess-form" @submit.prevent="submit()">
          <Search/><input ref="composer" v-model="guess" autocomplete="off" placeholder="输入球员中文名或英文名" aria-label="输入球员名字"><button type="submit" aria-label="提交答案"><ArrowRight/></button>
        </form>
        <div v-if="attempt >= 2" class="choice-grid"><button v-for="item in choices" :key="item.slug" @click="submit(item.zh)"><span>{{ item.flag }}</span>{{ item.zh }}</button></div>
        <div class="panel-footer"><button class="text-button" @click="reveal">直接揭晓</button><span>揭晓不计入猜中</span></div>
      </section>
    </section>

    <template v-else>
      <section class="reveal-hero">
        <div class="page-shell reveal-grid">
          <div class="reveal-copy">
            <p class="eyebrow"><span></span> TODAY'S PLAYER · {{ player.flag }} {{ player.nation }}</p>
            <p class="result"><Check v-if="status === 'won'"/><Sparkles v-else/>{{ message || (status === 'won' ? '你认出了今天的球星' : '今天的答案') }}</p>
            <h1>{{ player.zh }}</h1><p class="latin-name">{{ player.name }}</p><blockquote>“{{ player.kicker }}”</blockquote>
            <div class="reveal-actions"><button class="primary"><Share2/> 分享今日成绩</button><button class="secondary" @click="resetDemo"><RotateCcw/> 再看竞猜过程</button></div>
          </div>
          <article class="player-card">
            <div class="card-index"><span>{{ player.number }}</span><small>{{ player.position.split(' / ')[0] }}</small><b>{{ player.flag }}</b></div>
            <div class="portrait" :class="{ fallback: imageFailed }"><img v-if="!imageFailed" :src="player.image" :alt="player.zh" @error="imageFailed = true"><div v-else class="silhouette"><span>{{ player.flag }}</span><strong>{{ player.number }}</strong></div></div>
            <div class="card-name"><small>THE DAILY PORTRAIT</small><strong>{{ player.name }}</strong><span>{{ player.zh }} · {{ player.years }}</span></div>
            <a :href="player.image" target="_blank" rel="noreferrer">{{ player.credit }} <ExternalLink/></a>
          </article>
        </div>
      </section>

      <section class="dossier page-shell">
        <div class="section-heading"><div><p class="eyebrow"><span></span> 3 MINUTE DOSSIER</p><h2>三分钟读懂 {{ player.zh }}</h2></div><span>阅读约 3 分钟</span></div>
        <div class="story-grid"><p class="dropcap">{{ player.intro }}</p><aside><strong>位置</strong><span>{{ player.position }}</span><strong>国家 / 地区</strong><span>{{ player.flag }} {{ player.nation }}</span><strong>职业年代</strong><span>{{ player.years }}</span></aside></div>
        <div class="timeline"><article v-for="item in player.timeline" :key="item.year + item.title"><time>{{ item.year }}</time><span></span><div><h3>{{ item.title }}</h3><p>{{ item.text }}</p></div></article></div>
        <div class="feature-grid"><article><Trophy/><small>CAREER HONOURS</small><h3>代表荣誉</h3><ul><li v-for="honor in player.honors" :key="honor">{{ honor }}</li></ul></article><article><BookOpen/><small>THE MATCH</small><h3>从这一场开始看</h3><p>{{ player.match }}</p><button>查看比赛档案 <ChevronRight/></button></article><article><Sparkles/><small>ONE MORE THING</small><h3>你可能不知道</h3><p>{{ player.fact }}</p></article></div>
      </section>

      <section class="ask-band"><div class="page-shell ask-grid"><div><p class="eyebrow light"><span></span> ASK THE ARCHIVE</p><h2>关于 {{ player.zh }}，<br>再问深一点</h2><p>回答优先来自本站档案；事实与观点会明确区分，并附上资料出处。</p><div class="suggestions"><button @click="question='他的技术特点是什么？'; ask()">他的技术特点？</button><button @click="question='最值得看的比赛是哪场？'; ask()">推荐一场比赛</button><button @click="question='他有哪些代表荣誉？'; ask()">代表荣誉</button></div></div><div class="chat-card"><div class="chat-head"><span><MessageCircle/> 球星追问室</span><i></i></div><div class="chat-log"><div v-if="!chat.length" class="empty-chat"><span>星</span><p>可以问比赛、技术特点、关键转会与生涯故事。</p></div><div v-for="(item,index) in chat" :key="index" :class="['bubble', item.role]">{{ item.text }}</div></div><form @submit.prevent="ask"><input v-model="question" placeholder="问一个关于这位球员的问题…"><button aria-label="发送"><Send/></button></form><small>回答可能不完整，请以列出的原始资料为准。</small></div></div></section>
    </template>
  </main>

  <main v-else-if="view === 'archive'" class="archive page-shell"><div class="archive-head"><p class="eyebrow"><span></span> PLAYER ARCHIVE</p><h1>球星档案馆</h1><p>从传奇到当代，以比赛和故事重新认识每一位球星。</p></div><div class="archive-grid"><button v-for="item in players" :key="item.slug" @click="player=item; imageFailed=false; status='revealed'; message='球星档案'; show('today')"><span>{{ item.flag }}</span><small>{{ item.position }}</small><strong>{{ item.zh }}</strong><em>{{ item.name }}</em><i>{{ item.number }}</i></button></div></main>

  <main v-else class="sources page-shell"><p class="eyebrow"><span></span> EDITORIAL & SOURCES</p><h1>认真对待每一条资料</h1><div class="source-copy"><section><h2>内容原则</h2><p>每日一星是一份面向足球爱好者的轻量球员档案。生涯节点、荣誉和比赛信息优先参考 FIFA、UEFA、俱乐部官网及可靠统计资料。观点性描述与事实信息分开呈现。</p></section><section><h2>图片与授权</h2><p>首版球员图片从 Wikimedia Commons 按许可使用，并在卡片下方提供来源入口。无法确认许可或无法加载时，页面自动显示由国旗、号码、位置和年代组成的档案卡。</p></section><section><h2>AI 追问边界</h2><p>当前演示由本地档案生成回答，不掌握的内容会明确说明。接入模型后仍要求引用来源，不以生成内容替代事实核验。</p></section></div></main>

  <footer><div class="page-shell"><span class="brand"><span class="brand-mark">星</span>每日一星</span><p>一日一人，重新认识足球。</p><span>© 2026 DAILY STAR</span></div></footer>
</template>
