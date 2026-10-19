"use client";
import {useEffect,useState,type ReactNode} from 'react';import {usePathname,useRouter} from 'next/navigation';import {apiFetch} from '@/lib/api';import type {SetupStatus} from '@/lib/dealer-profile';
export function SetupGate({children}:{children:ReactNode}){const path=usePathname(),router=useRouter(),[checked,setChecked]=useState(''),[error,setError]=useState('');const protectedPage=/^\/(pratiche|progetto|prova|wizard|cataloghi|demo)(\/|$)/.test(path);
 useEffect(()=>{if(!protectedPage)return;let active=true;setError('');apiFetch<SetupStatus>('/setup').then(s=>{if(!active)return;const preparing=path.startsWith('/cataloghi');if(!s.acceptance||!preparing&&!s.completed)router.replace('/impostazioni');else setChecked(path);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[path,protectedPage,router]);
 if(protectedPage&&checked!==path)return <main style={{padding:30}}><p role="status">{error||'Verifica configurazione del rivenditore…'}</p>{error&&<a href="/?next=/impostazioni">Accedi</a>}</main>;return children;
}
