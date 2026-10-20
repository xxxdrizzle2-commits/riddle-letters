import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './Shell'
import './styles.css'
import './v1.css'

const root = createRoot(document.getElementById('root')!)
root.render(<React.StrictMode><App/></React.StrictMode>)
