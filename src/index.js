import React from 'react'
import ReactDOM from 'react-dom'
import './index.css'
import App from './App'

import {response} from "./alertResponse";

ReactDOM.render(<App rows={response.results.alerts} columns={response.results.columns}/>, document.getElementById('root'))
