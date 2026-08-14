<script setup lang="ts">
import { computed } from 'vue'
import { getFootballAsset, type MarketValuePoint } from '../player-data'
const props = defineProps<{ points: MarketValuePoint[] }>()
const displayPoints = computed(() => {
  if (props.points.length <= 20) return props.points
  const step = (props.points.length - 1) / 19
  return Array.from({ length: 20 }, (_, index) => props.points[Math.round(index * step)]!)
})
const maxValue = computed(() => Math.ceil(Math.max(...displayPoints.value.map(item => item.value), 1) / 10) * 10)
const ticks = computed(() => [1, .75, .5, .25, 0].map((ratio) => ({ value: maxValue.value * ratio, y: 24 + (1 - ratio) * 154 })))
const coords = computed(() => {
  return displayPoints.value.map((item, index) => ({ ...item, x: 54 + index * (522 / Math.max(displayPoints.value.length - 1, 1)), y: 24 + (1 - item.value / maxValue.value) * 154 }))
})
const path = computed(() => coords.value.map((point,index) => `${index?'L':'M'} ${point.x} ${point.y}`).join(' '))
</script>
<template>
  <div class="market-chart">
    <svg viewBox="0 0 600 220" role="img" aria-label="球员身价变化折线图">
      <g v-for="tick in ticks" :key="tick.value"><line x1="54" :y1="tick.y" x2="576" :y2="tick.y" class="grid-line"/><text x="46" :y="tick.y+3" text-anchor="end" class="axis-label">€{{ tick.value }}m</text></g>
      <path :d="`${path} L 576 190 L 54 190 Z`" class="area" />
      <path :d="path" class="value-line" />
      <g v-for="(point,index) in coords" :key="point.date ?? `${point.year}-${index}`" class="value-point"><circle :cx="point.x" :cy="point.y" r="4"/><image v-if="getFootballAsset(point.club)" :href="getFootballAsset(point.club)?.src" :x="point.x-11" :y="point.y-30" width="22" height="22" preserveAspectRatio="xMidYMid meet"/><text v-else :x="point.x" :y="point.y-10" text-anchor="middle">€{{ point.value }}m</text><text v-if="index % 2 === 0 || index === coords.length-1" :x="point.x" y="209" text-anchor="middle" class="year">{{ point.year }}</text></g>
    </svg>
  </div>
</template>
