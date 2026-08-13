<script setup lang="ts">
import { computed } from 'vue'
import { getFootballAsset, type MarketValuePoint } from '../player-data'
const props = defineProps<{ points: MarketValuePoint[] }>()
const coords = computed(() => {
  const max = Math.max(...props.points.map(item => item.value), 1)
  return props.points.map((item, index) => ({ ...item, x: 24 + index * (552 / Math.max(props.points.length - 1, 1)), y: 28 + (1 - item.value / max) * 150 }))
})
const path = computed(() => coords.value.map((point,index) => `${index?'L':'M'} ${point.x} ${point.y}`).join(' '))
</script>
<template>
  <div class="market-chart">
    <svg viewBox="0 0 600 220" role="img" aria-label="球员身价变化折线图">
      <line v-for="y in [28,78,128,178]" :key="y" x1="24" :y1="y" x2="576" :y2="y" class="grid-line" />
      <path :d="`${path} L 576 190 L 24 190 Z`" class="area" />
      <path :d="path" class="value-line" />
      <g v-for="point in coords" :key="point.year" class="value-point"><circle :cx="point.x" :cy="point.y" r="4"/><image v-if="getFootballAsset(point.club)" :href="getFootballAsset(point.club)?.src" :x="point.x-11" :y="point.y-30" width="22" height="22" preserveAspectRatio="xMidYMid meet"/><text v-else :x="point.x" :y="point.y-10" text-anchor="middle">€{{ point.value }}m</text><text :x="point.x" y="209" text-anchor="middle" class="year">{{ point.year }}</text></g>
    </svg>
    <div class="market-point-captions"><span v-for="point in coords" :key="point.year"><b>€{{ point.value }}m</b><small>{{ point.club }}</small></span></div>
  </div>
</template>
