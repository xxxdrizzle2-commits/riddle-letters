import { Link } from 'react-router'
import { ArrowRight, Feather, Mail, BookOpen, ShieldCheck } from 'lucide-react'
import type { Role } from '../types'

export const roleNames: Record<Role, string> = { child: '小朋友', volunteer: '志愿者', teacher: '老师', operator: '运营人员' }
export const spaceNames: Record<Role, string> = { child: '我的信箱', volunteer: '陪伴任务', teacher: '收发任务', operator: '运营任务' }
export function RoleEntry({ onSelect }: { onSelect?: () => void }) {
  return <section className="role-entry" aria-labelledby="entry-title">
    <h2 id="entry-title">你好，你想从哪里开始？</h2>
    <div className="identity-options">
      <Link to="/login/child" className="identity-card" onClick={onSelect}><span className="identity-icon"><Mail /></span><span><strong>我是小朋友</strong><small>读信、写信，分享小发现</small></span><ArrowRight size={18}/></Link>
      <Link to="/login/volunteer" className="identity-card" onClick={onSelect}><span className="identity-icon honey"><Feather /></span><span><strong>我是志愿者</strong><small>认识伙伴，认真回应</small></span><ArrowRight size={18}/></Link>
      <Link to="/login/teacher" className="identity-card" onClick={onSelect}><span className="identity-icon peach"><BookOpen /></span><span><strong>我是老师</strong><small>帮助小朋友收信、寄信</small></span><ArrowRight size={18}/></Link>
    </div>
    <div className="entry-secondary"><Link to="/login/operator" onClick={onSelect}><ShieldCheck size={16}/>运营人员入口</Link><Link to="/demo">先体验 Demo<ArrowRight size={15}/></Link></div>
  </section>
}
