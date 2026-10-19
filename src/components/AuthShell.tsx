"use client";
import Link from 'next/link';
import type {ReactNode} from 'react';
import {LanguageSwitcher} from './LanguageSwitcher';
import {useI18n} from '@/lib/i18n';
import '@/app/prova/prova.css';
import '@/app/accesso.css';
export function AuthShell({children}:{children:ReactNode}){const {lang}=useI18n();return <div className="pv pv-accesso"><header className="pv-header"><Link href="/" className="pv-logo" aria-label="Pergolando"><span className="pv-wordmark" aria-hidden="true">perg<span className="pv-slashed-o">o</span>land<span className="pv-slashed-o">o</span></span></Link><LanguageSwitcher/></header><main className="pv-main"><div className="pv-kicker">{lang==='en'?'YOUR PROJECT, BROUGHT TO LIFE':'IL TUO PROGETTO, DAL VIVO'}</div><section className="pv-card">{children}</section></main></div>;}
