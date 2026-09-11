import type {MetadataRoute} from 'next';
export default function manifest():MetadataRoute.Manifest{return {name:'RLA Nexo',short_name:'Nexo',description:'Seu assistente financeiro pessoal',start_url:'/',display:'standalone',background_color:'#f4f7f8',theme_color:'#184f4c',icons:[{src:'/nexo-mascote.png',sizes:'1254x1254',type:'image/png',purpose:'any'}]};}
