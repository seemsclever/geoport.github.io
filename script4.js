// Загрузка конфигурации слоев из JSON
function loadLayerConfig() {
    return fetch('layersConfig.json')
        .then(response => response.json())
        .then(data => data.groups) // получаем группы слоев
        .catch(err => {
            console.error("Ошибка загрузки конфигурации слоев:", err);
            return [];
        });
}

// Создание карты
let osmLayer = new ol.layer.Tile({
    source: new ol.source.OSM()
});

// Загрузка конфигурации слоев и создание карты
loadLayerConfig().then(groups => {
    const layers = [];

    groups.forEach(group => {
        const groupLayers = group.layers.map(layerConfig => {
            return new ol.layer.Tile({
                source: new ol.source.TileWMS({
                    url: `http://localhost:8080/geoserver/ows?service=WMS&version=1.1.1&request=GetMap&layers=${layerConfig.name}&format=image/png&srs=EPSG:4326&width=256&height=256`,
                    params: {
                        'LAYERS': layerConfig.name, // название слоя WMS
                        'TILED': true,
                    },
                    serverType: 'geoserver'
                }),
                visible: true
            });
        });

        const layerGroup = new ol.layer.Group({
            layers: groupLayers,
            visible: true,
            name: group.name
        });

        layers.push(layerGroup);
    });

    const map = new ol.Map({
        target: 'map',
        layers: [osmLayer, ...layers], // используем spread-оператор для всех слоев
        view: new ol.View({
            center: ol.proj.fromLonLat([55.9411, 54.7243]),
            zoom: 19.2
        }),
        controls: [] // Убираем все стандартные элементы управления
    });

    function loadLayerIcons() {
        groups.forEach(group => {
            group.layers.forEach(layer => {
                const imgElement = document.querySelector(`img[data-layer="${layer.name}"]`);
                if (imgElement) {
                    imgElement.src = `http://localhost:8080/geoserver/diplom/wms?service=WMS&version=1.1.0&request=GetLegendGraphic&layer=${encodeURIComponent(layer.name)}&format=image/png`;
                }
            });
        });
    }

    // Загружаем иконки только после полной загрузки карты
    map.once('postrender', loadLayerIcons);
});

// Отображаем модальное окно
document.getElementById('download-geojson').onclick = function () {
    document.getElementById('layer-selection-modal').style.display = 'block';
};

// Закрытие модального окна
document.getElementById('close-modal').onclick = function () {
    document.getElementById('layer-selection-modal').style.display = 'none';
};

// Обработчик нажатия на кнопку скачивания выделенных слоев
document.getElementById('download-selected-layers').onclick = function () {
    const checkboxes = document.querySelectorAll('#layer-selection-modal input[type="checkbox"]:checked:not(.toggle-group)');
    const layersToDownload = Array.from(checkboxes).map(cb => cb.value);

    // Скачивание только отмеченных слоев
    layersToDownload.forEach(layerName => {
        const url = `http://localhost:8080/geoserver/geoportal/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${layerName}&outputFormat=application/json`;

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Сеть не отвечает: ' + response.status);
                }
                return response.blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `${layerName}.geojson`;
                // Имя файла теперь определяется только по названию слоя
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            })
            .catch(err => {
                console.error('Ошибка:', err);
                alert(`Ошибка при загрузке данных для слоя '${layerName}'.`);
            });
    });

    // Закрытие модального окна
    document.getElementById('layer-selection-modal').style.display = 'none';
};