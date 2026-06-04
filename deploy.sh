#!/bin/bash
set -e

SERVER="root@8.160.161.113"
REMOTE_DIR="/opt/one2many-analyse"

echo "==> 1/5 同步代码到服务器..."
ssh $SERVER "mkdir -p $REMOTE_DIR"
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='data' \
  --exclude='uploads' \
  --exclude='.git' \
  --exclude='.env' \
  ./ $SERVER:$REMOTE_DIR/

echo "==> 2/5 在服务器上构建 Docker 镜像..."
ssh $SERVER "cd $REMOTE_DIR && docker compose build"

echo "==> 3/5 停止旧容器..."
ssh $SERVER "cd $REMOTE_DIR && docker compose down || true"

echo "==> 4/5 启动新容器..."
ssh $SERVER "cd $REMOTE_DIR && mkdir -p data/reports uploads && docker compose up -d"

echo "==> 5/5 检查状态..."
ssh $SERVER "cd $REMOTE_DIR && docker compose ps && echo '---' && docker compose logs --tail=5"

echo ""
echo "==> 部署完成！访问 http://8.160.161.113:3000"
