"""StoryForge Server 配置"""
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")

os.makedirs(DATA_DIR, exist_ok=True)

HOST = "127.0.0.1"
PORT = 8790

# 媒体资源目录（外部真实素材，分别挂载为 /media/sprites 与 /media/backgrounds）
SPRITE_DIR = r"E:\Share_folder\PicUP\悠宝的日常"
BACKGROUND_DIR = r"E:\output"
