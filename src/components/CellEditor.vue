<template>
  <div class="modal-mask">
    <div class="modal-form">
      <h4>编辑格子</h4>
      <div class="info">{{ dayLabel }} · {{ cell.slotKey }}</div>
      <form @submit.prevent="onSave">
        <div class="form-row">
          <label>事件名</label>
          <input v-model="local.eventName" />
        </div>
        <div class="form-row">
          <label>备注</label>
          <input v-model="local.notes" />
        </div>
        <div class="form-row actions">
          <button type="submit" class="btn-save clickable">保存</button>
          <button type="button" class="btn-cancel clickable" @click="$emit('close')">取消</button>
          <button type="button" class="btn-del clickable" @click="onDelete">清除</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CellEditor',
  props: {
    cell: { type: Object, required: true },
    weekStartIso: String
  },
  emits: ['save', 'delete', 'close'],
  data() {
    return {
      local: { eventName: this.cell.eventName || '', notes: this.cell.notes || '' }
    }
  },
  computed: {
    dayLabel() {
      // weekDay: 1..7
      const names = ['周一','周二','周三','周四','周五','周六','周日']
      return names[(this.cell.weekDay||1)-1]
    }
  },
  methods: {
    onSave() {
      this.$emit('save', { weekDay: this.cell.weekDay, slotKey: this.cell.slotKey, patch: { eventName: this.local.eventName, notes: this.local.notes, taskId: this.cell.taskId || '' } })
    },
    onDelete() {
      this.$emit('delete', { weekDay: this.cell.weekDay, slotKey: this.cell.slotKey })
    }
  }
}
</script>

<style scoped>
.modal-mask { position: fixed; left:0;right:0;top:0;bottom:0; display:flex;align-items:center;justify-content:center; background: rgba(0,0,0,0.25); z-index:2000 }
.modal-form { background:#232a36;padding:18px;border-radius:10px;min-width:320px }
.form-row { display:flex;align-items:center;gap:8px;margin-bottom:10px }
.form-row label { width:70px;color:var(--muted,#9aa4b2) }
.form-row input { flex:1;padding:6px;border-radius:6px;border:1px solid #232a36;background:#181e2a;color:var(--text,#e6e8eb) }
.actions { display:flex;gap:8px;justify-content:flex-end }
.btn-save { background:var(--accent,#5f9bff);color:#fff;padding:6px 12px;border-radius:6px;border:none; }
.btn-cancel { background:none;border:1px solid #232a36;color:var(--muted,#9aa4b2);padding:6px 10px;border-radius:6px; }
.btn-del { background:#ff6b6b;color:#fff;padding:6px 10px;border-radius:6px;border:none; }
.info { color:var(--muted,#9aa4b2); margin-bottom:8px }
</style>
