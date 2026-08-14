<script setup lang="ts">
import { computed } from 'vue'
import { getFootballAsset } from '../player-data'
import type { SeasonStat } from '../player-data'
const props = defineProps<{ stats: SeasonStat[]; aggregateByClub?: boolean }>()

const rows = computed(() => {
  if (!props.aggregateByClub) return [...props.stats].reverse().map((row) => ({ ...row, label: row.season, note: row.club }))
  const totals = new Map<string, SeasonStat>()
  for (const row of props.stats) {
    const current = totals.get(row.club) ?? { season: '', club: row.club, appearances: 0, starts: 0, goals: 0, assists: 0 }
    current.appearances += row.appearances
    current.starts = (current.starts ?? 0) + (row.starts ?? 0)
    current.goals += row.goals
    current.assists += row.assists
    totals.set(row.club, current)
  }
  return [...totals.values()].sort((a, b) => b.appearances - a.appearances)
    .map((row) => ({ ...row, label: row.club, note: '俱乐部生涯总计' }))
})
</script>
<template>
  <div class="season-list">
    <article v-for="season in rows" :key="`${season.club}-${season.label}`" class="season-card">
      <header>
        <span class="season-club"><img v-if="getFootballAsset(season.club)" :src="getFootballAsset(season.club)?.src" :alt="season.club"><b v-else>{{ season.club.slice(0,1) }}</b></span>
        <div><strong>{{ season.label }}</strong><small>{{ season.note }}</small></div>
      </header>
      <dl>
        <div><dt>首发</dt><dd>{{ season.starts ?? 0 }}</dd></div>
        <div><dt>替补</dt><dd>{{ Math.max(0, season.appearances - (season.starts ?? 0)) }}</dd></div>
        <div><dt>进球</dt><dd>{{ season.goals }}</dd></div>
        <div><dt>助攻</dt><dd>{{ season.assists }}</dd></div>
      </dl>
    </article>
  </div>
</template>
