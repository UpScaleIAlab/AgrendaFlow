'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {Moon,Sun} from 'lucide-react';

type Theme='light'|'dark';
const ThemeContext=createContext<{theme:Theme;setTheme:(theme:Theme)=>void}>({theme:'light',setTheme:()=>{}});
export function ThemeProvider({children}:{children:ReactNode}){
 const [theme,setThemeState]=useState<Theme>('light');
 useEffect(()=>{const saved=window.localStorage.getItem('fmdg-theme');if(saved==='dark'||saved==='light')setThemeState(saved)},[]);
 useEffect(()=>{document.documentElement.classList.toggle('theme-dark',theme==='dark');document.documentElement.style.colorScheme=theme;},[theme]);
 const setTheme=(next:Theme)=>{setThemeState(next);window.localStorage.setItem('fmdg-theme',next)};
 return <ThemeContext.Provider value={{theme,setTheme}}>{children}</ThemeContext.Provider>;
}
export function ThemeSwitcher(){
 const {theme,setTheme}=useContext(ThemeContext);
 return <div role="group" aria-label="Tema de apariencia" className="theme-switcher inline-flex items-center rounded-full border p-1">
  <button type="button" onClick={()=>setTheme('light')} aria-pressed={theme==='light'} title="Tema claro" className={`theme-choice ${theme==='light'?'theme-choice-active':''}`}><Sun size={15}/><span className="hidden sm:inline">Claro</span></button>
  <button type="button" onClick={()=>setTheme('dark')} aria-pressed={theme==='dark'} title="Tema oscuro" className={`theme-choice ${theme==='dark'?'theme-choice-active':''}`}><Moon size={15}/><span className="hidden sm:inline">Oscuro</span></button>
 </div>;
}