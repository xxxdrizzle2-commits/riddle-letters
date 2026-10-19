import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initialize } from './data'
import './styles.css'

const root = createRoot(document.getElementById('root')!)
initialize().then(() => root.render(<React.StrictMode><App/></React.StrictMode>)).catch(() => root.render(<main className="startup-error"><h1>暂时打不开这只信箱</h1><p>浏览器未能读取本地演示数据。请允许本站使用本地存储，或换一个普通浏览窗口重试。</p><button className="btn" onClick={() => location.reload()}>重新打开</button><p>你的信件不会被自动上传。</p></main>))
