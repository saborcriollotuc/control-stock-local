// ⚙️ CONFIGURACIÓN - REEMPLAZA ESTOS DATOS CON LOS TUYOS
const SUPABASE_URL = 'https://lesstqixhpshcgzkmtuj.supabase.co';  // URL de Supabase
const SUPABASE_KEY = 'sb_publishable_ChyxkvsadjBSXKpbhFKsYA_TjxuAteA';  // API Key de Supabase

// Variables globales
let productoSeleccionado = null;
let tipoMovimiento = '';

// Cargar productos cuando se abre la página
document.addEventListener('DOMContentLoaded', function() {
    cargarProductos();
    setInterval(cargarProductos, 30000); // Actualizar cada 30 segundos
});

// Función para cargar productos desde Supabase
async function cargarProductos() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/productos?select=*`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        const productos = await response.json();
        mostrarProductos(productos);
        verificarAlertas(productos);
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('cargando').innerHTML = 
            '⚠️ Error al cargar productos. Recarga la página.';
    }
}

// Mostrar productos en la tabla
function mostrarProductos(productos) {
    const tbody = document.getElementById('lista-productos');
    tbody.innerHTML = '';
    
    productos.forEach(producto => {
        const fila = document.createElement('tr');
        
        // Marcar en rojo si el stock es bajo
        const stockBajo = producto.cantidad <= (producto.minimo_stock || 5);
        if (stockBajo) {
            fila.style.backgroundColor = '#fff5f5';
        }
        
        fila.innerHTML = `
            <td>
                <strong>${producto.nombre}</strong>
                ${producto.categoria ? `<br><small class="categoria">${producto.categoria}</small>` : ''}
            </td>
            <td>
                <span class="${stockBajo ? 'stock-bajo' : 'stock-normal'}">
                    ${producto.cantidad}
                </span>
            </td>
            <td>${producto.unidad_medida || 'unidad'}</td>
            <td>
                <button onclick="seleccionarProducto(${producto.id}, 'entrada')" 
                        class="btn-mini btn-success">
                    <i class="fas fa-plus"></i>
                </button>
                <button onclick="seleccionarProducto(${producto.id}, 'salida')" 
                        class="btn-mini btn-danger">
                    <i class="fas fa-minus"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(fila);
    });
    
    // Ocultar "cargando" y mostrar tabla
    document.getElementById('cargando').style.display = 'none';
    document.getElementById('tabla').style.display = 'table';
}

// Agregar nuevo producto
async function agregarProducto() {
    const nombre = document.getElementById('nombre').value;
    const cantidad = document.getElementById('cantidad').value;
    const unidad = document.getElementById('unidad').value;
    const categoria = document.getElementById('categoria').value;
    
    if (!nombre || !cantidad) {
        alert('⚠️ Completa al menos nombre y cantidad');
        return;
    }
    
    const producto = {
        nombre: nombre,
        cantidad: parseInt(cantidad),
        unidad_medida: unidad,
        categoria: categoria
    };
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/productos`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(producto)
        });
        
        if (response.ok) {
            // Limpiar formulario
            document.getElementById('nombre').value = '';
            document.getElementById('cantidad').value = '';
            
            // Recargar lista
            cargarProductos();
            
            alert('✅ Producto agregado correctamente');
        }
    } catch (error) {
        alert('❌ Error al agregar producto');
    }
}

// Seleccionar producto para movimiento
function seleccionarProducto(id, tipo) {
    productoSeleccionado = id;
    tipoMovimiento = tipo;
    
    const modal = document.getElementById('modal');
    const titulo = document.getElementById('modal-titulo');
    
    titulo.textContent = tipo === 'entrada' 
        ? '📥 Entrada de Stock' 
        : '📤 Salida de Stock';
    
    // Limpiar campos
    document.getElementById('cantidad-movimiento').value = '';
    document.getElementById('motivo-movimiento').value = '';
    
    modal.style.display = 'flex';
}

// Confirmar movimiento
async function confirmarMovimiento() {
    const cantidad = document.getElementById('cantidad-movimiento').value;
    const motivo = document.getElementById('motivo-movimiento').value;
    
    if (!cantidad || cantidad <= 0) {
        alert('⚠️ Ingresa una cantidad válida');
        return;
    }
    
    try {
        // 1. Registrar el movimiento
        const movimiento = {
            producto_id: productoSeleccionado,
            tipo: tipoMovimiento,
            cantidad: parseInt(cantidad),
            motivo: motivo || 'Sin motivo especificado'
        };
        
        await fetch(`${SUPABASE_URL}/rest/v1/movimientos`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(movimiento)
        });
        
        // 2. Actualizar stock del producto
        // Primero obtenemos el producto actual
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/productos?id=eq.${productoSeleccionado}`,
            {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            }
        );
        
        const [producto] = await response.json();
        let nuevaCantidad = producto.cantidad;
        
        if (tipoMovimiento === 'entrada') {
            nuevaCantidad += parseInt(cantidad);
        } else {
            nuevaCantidad -= parseInt(cantidad);
        }
        
        // Actualizar producto
        await fetch(`${SUPABASE_URL}/rest/v1/productos?id=eq.${productoSeleccionado}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cantidad: nuevaCantidad })
        });
        
        // Cerrar modal y recargar
        cerrarModal();
        cargarProductos();
        
        alert('✅ Movimiento registrado correctamente');
        
    } catch (error) {
        alert('❌ Error al registrar movimiento');
    }
}

// Verificar alertas de stock bajo
function verificarAlertas(productos) {
    const productosBajos = productos.filter(p => p.cantidad <= (p.minimo_stock || 5));
    
    if (productosBajos.length > 0) {
        const alertasDiv = document.getElementById('lista-alertas');
        alertasDiv.innerHTML = productosBajos.map(p => `
            <div class="alerta-item">
                <i class="fas fa-exclamation-circle"></i>
                <strong>${p.nombre}</strong> - 
                Quedan ${p.cantidad} ${p.unidad_medida || 'unidad'}
                (Mínimo: ${p.minimo_stock || 5})
            </div>
        `).join('');
        
        document.getElementById('alertas').style.display = 'block';
    } else {
        document.getElementById('alertas').style.display = 'none';
    }
}

// Funciones del modal
function cerrarModal() {
    document.getElementById('modal').style.display = 'none';
    productoSeleccionado = null;
    tipoMovimiento = '';
}

// Funciones para botones rápidos
function mostrarEntrada() {
    const productos = document.querySelectorAll('#lista-productos tr');
    if (productos.length === 0) {
        alert('⚠️ Primero agrega algunos productos');
        return;
    }
    alert('📥 Selecciona un producto y haz clic en el botón "+" para entrada de stock');
}

function mostrarSalida() {
    const productos = document.querySelectorAll('#lista-productos tr');
    if (productos.length === 0) {
        alert('⚠️ Primero agrega algunos productos');
        return;
    }
    alert('📤 Selecciona un producto y haz clic en el botón "-" para salida de stock');
}

// Estilos adicionales
const estilosAdicionales = `
    .btn-mini {
        padding: 8px 12px;
        margin: 0 5px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        font-size: 14px;
    }
    
    .stock-bajo {
        color: #e53e3e;
        font-weight: bold;
        background: #fed7d7;
        padding: 3px 8px;
        border-radius: 4px;
    }
    
    .stock-normal {
        font-weight: bold;
        color: #2d3748;
    }
    
    .categoria {
        color: #718096;
        font-size: 12px;
    }
    
    .alerta-item {
        padding: 10px;
        background: white;
        margin-bottom: 8px;
        border-radius: 8px;
        border-left: 4px solid #f56565;
        display: flex;
        align-items: center;
        gap: 10px;
    }
`;

// Agregar estilos adicionales
const styleSheet = document.createElement('style');
styleSheet.textContent = estilosAdicionales;

document.head.appendChild(styleSheet);
