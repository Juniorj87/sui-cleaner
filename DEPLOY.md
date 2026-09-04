# Deploy Sui Cleaner — Render (free) + custom domain

## 1. Render — web service (5 минут, бесплатно)

1. Зарегистрируйтесь на https://render.com (можно через GitHub-аккаунт).
2. **New → Blueprint** → выберите репозиторий `sui-cleaner` (файл `render.yaml`
   уже в корне — Render сам подставит build/start/healthcheck).
   Либо вручную **New → Web Service**: Build Command `npm install && npm run build`,
   Start Command `npm run start`.
3. План **Free**.
4. Во вкладке **Environment** задайте переменные:
   - `NETWORK` = `mainnet`
   - `SUI_RPC_URL` = `https://sui.publicnode.com` (или своя нода)
   - `SERVICE_FEE_ADDRESS` = `0x…` адрес treasury — **обязательно**,
     иначе real cleanup останется заблокирован (fail-safe).
5. **Deploy**. Проверка: `https://<ваш-сервис>.onrender.com/api/config`
   должен вернуть JSON (`{"serviceFeeConfigured": true, ...}`).

> Free-план засыпает после ~15 минут без трафика: первый визит после паузы
> грузится 30–60 секунд. Для боевого режима позже можно перейти на Starter
> ($7/мес) — код менять не нужно.

## 2. Свой домен (куплен за крипту, напр. Porkbun/Namecheap)

1. В Render: сервис → **Settings → Custom Domain → Add** → введите домен.
2. Render покажет DNS-запись (обычно `CNAME` на `*.onrender.com`).
3. У регистратора (Porkbun: Domain Management → DNS) добавьте эту запись.
4. Подождите 5–60 минут (DNS + авто-HTTPS от Render). Готово.

## 3. Что проверить после деплоя

- `/` — лендинг грузится, фон на месте.
- `/app?demo=true` — демо-скан на 47 объектов.
- `/api/config` — `serviceFeeConfigured: true`.
- Кошелёк подключается, dry-run симуляция проходит.

## 4. Важно

- НИКОГДА не коммитьте `.env` и реальные ключи — только dashboard Render.
- AI-панель работает с ключом пользователя (вводит сам в UI), серверу
  отдельный AI-ключ не нужен.
