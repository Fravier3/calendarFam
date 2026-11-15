import {Account, Client, ID, Permission, Query, Role, Storage, TablesDB} from 'appwrite';

const endpoint = 'https://nyc.cloud.appwrite.io/v1';
const project = '6af38e0f00161165b763';
const databaseId = 'mantenimiento';
const tableId = 'calendar-fam';
const bucketId = 'calendar-fam-photos';
const client = new Client().setEndpoint(endpoint).setProject(project);
const account = new Account(client);
const tables = new TablesDB(client);
const storage = new Storage(client);
const permissions = user => [Permission.read(Role.user(user)),Permission.update(Role.user(user)),Permission.delete(Role.user(user))];

export async function session() {
  try {return await account.get();}
  catch(error) {if(error.code===401) return null; throw error;}
}
export async function signIn(email,password,name) {
  if (name) await account.create({userId:ID.unique(),email,password,name});
  await account.createEmailPasswordSession({email,password});
  return account.get();
}
export async function signOut() {await account.deleteSession({sessionId:'current'});}
export async function state() {
  const result=[];
  let last;
  do {
    const queries=[Query.limit(100),Query.orderAsc('$id')];
    if(last) queries.push(Query.cursorAfter(last));
    const page=(await tables.listRows({databaseId,tableId,queries})).rows;
    result.push(...page);
    last=page.length===100?page.at(-1).$id:null;
  } while(last);
  return result.flatMap(row=>{
    try {return [{...JSON.parse(row.payload),id:row.$id,kind:row.kind}];}
    catch {return [];}
  });
}
export async function saveRecord(user,kind,record,id) {
  const rowId=id||ID.unique();
  await tables.upsertRow({databaseId,tableId,rowId,data:{kind,payload:JSON.stringify(record)},permissions:permissions(user)});
  return rowId;
}
export async function deleteRecord(id) {await tables.deleteRow({databaseId,tableId,rowId:id});}
export async function upload(user,file) {
  return storage.createFile({bucketId,fileId:ID.unique(),file,permissions:permissions(user)});
}
export async function deletePhoto(fileId) {await storage.deleteFile({bucketId,fileId});}
export async function privatePhoto(fileId) {
  const path=storage.getFileDownload({bucketId,fileId});
  const headers={'X-Appwrite-Project':project};
  const fallback=localStorage.getItem('cookieFallback');
  if(fallback) headers['X-Fallback-Cookies']=fallback;
  const response=await fetch(path,{headers,credentials:'include'});
  if(!response.ok) throw new Error('No se pudo abrir la foto.');
  return URL.createObjectURL(await response.blob());
}
