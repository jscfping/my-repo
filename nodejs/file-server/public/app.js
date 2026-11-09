const { createApp, computed, ref } = Vue;

createApp({
    setup() {
        const entries = ref([]);
        const directory = ref("");
        const filesToUpload = ref([]);
        const loading = ref(false);
        const uploadInProgress = ref(false);
        const errorMessage = ref("");
        const successMessage = ref("");
        const pathParts = computed(() => directory.value ? directory.value.split("/") : []);

        function joinDirectory(current, name) {
            return current ? `${current}/${name}` : name;
        }

        async function api(url, options = {}) {
            const response = await fetch(url, options);
            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                throw new Error(result.error || `操作失敗（${response.status}）`);
            }
            return response;
        }

        async function loadDirectory(target = directory.value) {
            loading.value = true;
            errorMessage.value = "";
            successMessage.value = "";
            try {
                const query = new URLSearchParams({ directory: target });
                const response = await api(`/api/files?${query}`);
                const result = await response.json();
                directory.value = result.directory;
                entries.value = result.entries;
            } catch (error) {
                errorMessage.value = error.message;
            } finally {
                loading.value = false;
            }
        }

        function selectFiles(event) {
            filesToUpload.value = Array.from(event.target.files || []);
            event.target.value = "";
            errorMessage.value = "";
            successMessage.value = "";
        }

        function downloadUrl(entry) {
            const query = new URLSearchParams({ directory: directory.value, name: entry.name });
            return `/api/download?${query}`;
        }

        async function uploadFiles() {
            if (!filesToUpload.value.length) return;
            const form = new FormData();
            form.append("directory", directory.value);
            for (const file of filesToUpload.value) form.append("files", file, file.name);

            loading.value = true;
            uploadInProgress.value = true;
            errorMessage.value = "";
            successMessage.value = "";
            try {
                const response = await api("/api/upload", { method: "POST", body: form });
                const result = await response.json();
                successMessage.value = `已上傳 ${result.uploaded.length} 個檔案（同名檔案已覆寫）。`;
                filesToUpload.value = [];
                await loadDirectory(directory.value);
            } catch (error) {
                errorMessage.value = error.message;
            } finally {
                loading.value = false;
                uploadInProgress.value = false;
            }
        }

        async function deleteFile(entry) {
            if (!window.confirm(`確定刪除「${entry.name}」？此操作無法復原。`)) return;
            loading.value = true;
            errorMessage.value = "";
            successMessage.value = "";
            try {
                await api("/api/files", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ directory: directory.value, name: entry.name })
                });
                successMessage.value = `已刪除「${entry.name}」。`;
                await loadDirectory(directory.value);
            } catch (error) {
                errorMessage.value = error.message;
            } finally {
                loading.value = false;
            }
        }

        async function createFolder() {
            const name = window.prompt("請輸入新資料夾名稱：");
            if (name === null) return;
            if (!name.trim()) {
                errorMessage.value = "資料夾名稱不可空白。";
                return;
            }

            loading.value = true;
            errorMessage.value = "";
            successMessage.value = "";
            try {
                await api("/api/folders", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ directory: directory.value, name: name.trim() })
                });
                successMessage.value = `已建立資料夾「${name.trim()}」。`;
                await loadDirectory(directory.value);
            } catch (error) {
                errorMessage.value = error.message;
            } finally {
                loading.value = false;
            }
        }

        async function deleteFolder(entry) {
            if (!window.confirm(`確定刪除資料夾「${entry.name}」及其中所有內容？此操作無法復原。`)) return;
            loading.value = true;
            errorMessage.value = "";
            successMessage.value = "";
            try {
                await api("/api/folders", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ directory: directory.value, name: entry.name })
                });
                successMessage.value = `已刪除資料夾「${entry.name}」及其內容。`;
                await loadDirectory(directory.value);
            } catch (error) {
                errorMessage.value = error.message;
            } finally {
                loading.value = false;
            }
        }

        function formatSize(size) {
            if (size < 1024) return `${size} B`;
            if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
            if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
            return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
        }

        function formatDate(value) {
            return new Intl.DateTimeFormat("zh-TW", {
                dateStyle: "medium",
                timeStyle: "short"
            }).format(new Date(value));
        }

        loadDirectory("");

        return {
            directory,
            downloadUrl,
            entries,
            errorMessage,
            filesToUpload,
            createFolder,
            deleteFolder,
            formatDate,
            formatSize,
            joinDirectory,
            loadDirectory,
            loading,
            pathParts,
            selectFiles,
            successMessage,
            uploadFiles,
            uploadInProgress,
            deleteFile,
        };
    }
}).mount("#app");
