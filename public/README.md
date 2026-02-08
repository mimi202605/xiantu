# 静态资源目录

将**封面背景视频**放在此目录下，并命名为：

- **`ming_background.mp4`**

用于创角页、模式选择页等处的背景。若不存在该文件，将回退到默认在线地址。

支持其他格式（如 `.webm`）需同时修改 `src/components/common/VideoBackground.vue` 中的默认 `src` 与构建配置。
