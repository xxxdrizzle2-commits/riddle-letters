import { Link } from 'react-router'
import { ArrowRight, BookOpen, Feather, Mail, ShieldCheck } from 'lucide-react'
import type { Role } from '../types'

export const roleNames: Record<Role, string> = {
  child: '小朋友', volunteer: '志愿者', teacher: '老师', operator: '运营人员',
}

export const spaceNames: Record<Role, string> = {
  child: '信箱', volunteer: '陪伴任务', teacher: '收发任务', operator: '待处理',
}

const roles = [
  { role: 'child', title: '我是小朋友', description: '写一封信，读伙伴寄来的故事', icon: Mail, tone: '' },
  { role: 'volunteer', title: '我是志愿者', description: '认真回应，分享日常小发现', icon: Feather, tone: 'honey' },
  { role: 'teacher', title: '我是老师', description: '帮助打印、交付和回传书信', icon: BookOpen, tone: 'sage' },
  { role: 'operator', title: '我是运营人员', description: '安排结对、审核和持续跟进', icon: ShieldCheck, tone: 'peach' },
] as const

export function RoleEntry({ compact = false }: { compact?: boolean }) {
  return <section className={`role-entry${compact ? ' role-entry-compact' : ''}`} aria-labelledby="entry-title">
    <div className="role-entry-heading">
      <div><p className="eyebrow">选择演示身份</p><h2 id="entry-title">你想从哪一步开始？</h2></div>
      <p>四个入口都能直接操作。这里使用虚构人物，记录只保存在当前浏览器。</p>
    </div>
    <div className="identity-options">
      {roles.map(({ role, title, description, icon: Icon, tone }) => <Link key={role} to={`/demo/start/${role}`} className="identity-card">
        <span className={`identity-icon ${tone}`}><Icon size={25} strokeWidth={1.55}/></span>
        <span className="identity-copy"><strong>{title}</strong><small>{description}</small></span>
        <ArrowRight className="identity-arrow" size={18}/>
      </Link>)}
    </div>
  </section>
}
