const fs=require('fs'),path=require('path'),{Client}=require('pg'),assert=require('node:assert/strict');
process.loadEnvFile(path.resolve(__dirname,'../.env'));
const name='nexo_cloud_check_'+Date.now(),original=new URL(process.env.DATABASE_URL),url=new URL(original);url.pathname='/'+name;
const admin=new Client({connectionString:original.toString()});let db;
(async()=>{await admin.connect();await admin.query('CREATE DATABASE '+name);try{
 db=new Client({connectionString:url.toString()});await db.connect();
 // Simulate Supabase auth in an isolated database; never modify the personal database.
 await db.query("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; END $$;");
 await db.query("CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated,anon; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;");
 await db.query(fs.readFileSync(path.resolve(__dirname,'../supabase/schema.sql'),'utf8'));
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';await db.query('INSERT INTO auth.users VALUES($1),($2)',[a,b]);
 await db.query('SET ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[a]);
 await db.query('SELECT public.nexo_read($1)',[JSON.stringify({marker:'A'})]);
 await db.query('SELECT public.nexo_save(0,$1)',[JSON.stringify({marker:'A-saved'})]);
 await assert.rejects(db.query('SELECT public.nexo_save(0,$1)',[JSON.stringify({marker:'stale'})]),e=>e.code==='40001');
 await db.query("SELECT public.nexo_remember('hello A','reply A')");assert.equal((await db.query('SELECT public.nexo_chat_allow() AS ok')).rows[0].ok,true);assert.equal((await db.query('SELECT public.nexo_chat_allow() AS ok')).rows[0].ok,false);
 await assert.rejects(db.query('UPDATE public.nexo_chat_usage SET count=0'),e=>e.code==='42501');
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[b]);
 assert.equal((await db.query('SELECT * FROM public.nexo_state')).rowCount,0);assert.equal((await db.query('SELECT * FROM public.nexo_messages')).rowCount,0);
 await assert.rejects(db.query('INSERT INTO public.nexo_state(user_id,snapshot) VALUES($1,$2)',[a,'{}']),e=>e.code==='42501');
 assert.equal((await db.query('UPDATE public.nexo_state SET snapshot=$1 WHERE user_id=$2',['{}',a])).rowCount,0);
 await db.query('SELECT public.nexo_read($1)',[JSON.stringify({marker:'B'})]);
 await db.query('RESET ROLE');await db.query('SET ROLE anon');await assert.rejects(db.query('SELECT * FROM public.nexo_state'),e=>e.code==='42501');await assert.rejects(db.query('SELECT public.nexo_read($1)',['{}']),e=>e.code==='42501');
 console.log('PASS: isolated PostgreSQL — persistence, revision conflict, user isolation, anonymous denial, chat quota.');
 }finally{if(db)await db.end();await admin.query('DROP DATABASE '+name);await admin.end();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
