//Custom search del dialog
class CustomSearch extends HTMLElement {
  constructor() {
    super();
    this.games = [];
  }

  async connectedCallback() {
    // Elementos del DOM
    const siteSearch = document.querySelector('#site-search'); // Input externo
    const dialog = this.querySelector('dialog'); // Diálogo de resultados
    const closeBtn = this.querySelector('.close-btn'); // Botón para cerrar el diálogo
    const searchResults = this.querySelector('#search-results'); // Contenedor de resultados

    if (!siteSearch || !dialog || !searchResults) {
      console.error('Error: Missing required elements.');
      return;
    }

        // Mostrar el diálogo al escribir
        siteSearch.addEventListener('input', (event) => {
          const term = event.target.value.trim();
          if (term) {
            dialog.showModal(); // Mostrar diálogo si hay texto
            this.search(term); // Realizar búsqueda
          } else {
            dialog.close(); // Cerrar el diálogo si no hay texto
          }
        });
    
        // Cerrar el diálogo al hacer clic fuera del contenido
        dialog.addEventListener('click', (event) => {
          if (event.target === dialog) {
            dialog.close();
            clearSearch();
          }
        });
    
        // Cerrar el diálogo al hacer clic en el botón de cierre
        closeBtn.addEventListener('click', () => {
          dialog.close();
          clearSearch();
        });
    
        // Función para limpiar el input y los resultados
        function clearSearch() {
          siteSearch.value = '';
          searchResults.innerHTML = '';
        }

    // Cargar datos desde la API
    await this.fetchGames();
  }

  async fetchGames() {
    try {
      const response = await fetch('https://products-foniuhqsba-uc.a.run.app/Games');
      if (!response.ok) throw new Error('Failed to fetch games');
      this.games = await response.json();
    } catch (error) {
      console.error('Error fetching games:', error);
      const searchResults = this.querySelector('#search-results');
      searchResults.innerHTML =
        '<li class="text-red-500">Error loading games. Please try again later.</li>';
    }
  }

  search(term = '') {
    const searchResults = this.querySelector('#search-results');
    searchResults.innerHTML = '';

    const filteredGames = this.games.filter((game) =>
      game.title.toLowerCase().includes(term.toLowerCase())
    );

    if (filteredGames.length === 0) {
      searchResults.innerHTML = '<li class="text-gray-500">No results found for your search.</li>';
      return;
    }

    const template = this.querySelector('template').content;

    filteredGames.forEach((game) => {
      const li = template.querySelector('li').cloneNode(true);
      li.querySelector('.item-image').src = game.image || 'default-image.png';
      li.querySelector('.item-title').textContent = game.title;
      li.querySelector('.item-platform').textContent =
        game.features.find((f) => f.type === 'platform')?.value || 'Unknown Platform';
      li.querySelector('.item-genre').textContent =
        game.features.find((f) => f.type === 'genre')?.value || 'Unknown Genre';

      const enlace = li.querySelector('.item-title');
      enlace.href = game.id ? `producto.html?id=${game.id}` : '#';

      searchResults.appendChild(li);
    });
  }
}

customElements.define('custom-search', CustomSearch);

//Para almacenar los datos del carrito entre páginas, es mejor que usar el localstorage o las cookies, IndexedDB es una base de datos NoSQL integrada en los navegadores web modernos.
// IndexedDB: Inicialización
function openDatabase() {//Abrir una conexión a la base de datos
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ShoppingCartDB', 1);//crea BD llamada ShoppingCartDB

    request.onupgradeneeded = (event) => {//Se ejecuta cuando se crea o actualiza la base de datos
      const db = event.target.result;
      if (!db.objectStoreNames.contains('cart')) { //Busca si existe "almacén de objetos" cart, sino lo crea
        db.createObjectStore('cart', { keyPath: 'id' }); // 'id' es único para cada producto
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);//Resuelve la promesa
    request.onerror = (event) => reject(event.target.error);
  });
}

// IndexedDB: Añadir producto
async function addToIndexedDB(product) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('cart', 'readwrite');//Abre una transacción con permisos de lectura y escritura para el almacén cart
    const store = transaction.objectStore('cart');
    const request = store.put(product); // Inserta o actualiza el objeto product en el almacén

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// IndexedDB: Obtener todos los productos
async function getFromIndexedDB() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('cart', 'readonly');//Crea una transacción con permisos de solo lectura
    const store = transaction.objectStore('cart');
    const request = store.getAll();//Recupera todos los elementos del almacén cart

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// IndexedDB: Eliminar producto
async function removeFromIndexedDB(productId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('cart', 'readwrite');
    const store = transaction.objectStore('cart');
    const request = store.delete(productId);//Elimina el producto con el identificador productId

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// IndexedDB: Vaciar carrito
async function clearIndexedDB() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('cart', 'readwrite');
    const store = transaction.objectStore('cart');
    const request = store.clear();//Limpia todos los datos del almacén cart

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

//Carrito
class ShoppingCart {
  constructor() {
    this.carrito = []; // Este array se sincronizará con IndexedDB
    this.dialog = document.getElementById('cart-dialog');
    this.cartContent = document.getElementById('cart-content');
    this.contadorCarrito = document.getElementById('contadorCarrito');
    this.cartTotal = document.getElementById('cart-total');
    this.emptyCartBtn = document.getElementById('empty-cart');
    this.checkoutBtn = document.getElementById('checkout');
    this.emptyMessage = document.getElementById('empty-message');
    this.init();
  }

  async init() {
    // Carga el carrito desde IndexedDB al inicializar
    this.carrito = await getFromIndexedDB();
    this.updateCartCounter();
    this.renderCart();

    // Configura eventos de los botones
    document.getElementById('abrirCarrito').addEventListener('click', () => this.openCart());
    this.emptyCartBtn.addEventListener('click', () => this.emptyCart());
    this.checkoutBtn.addEventListener('click', () => this.checkout());

    const closeCartBtn = document.getElementById('close-cart');
    closeCartBtn.addEventListener('click', () => {
      this.dialog.close();
    });

    // Delegación de eventos para "Añadir a carrito"
    document.body.addEventListener('click', (event) => {
      if (event.target && event.target.id === 'addCarrito') {
        const producto = {
          id: parseInt(event.target.getAttribute('data-id')),//Al principio pensaba que los data debían añadirse también en el html, no es necesario, sobretodo si se va a generar las cosas de forma dinámica
          title: event.target.getAttribute('data-title'),
          description: event.target.getAttribute('data-description'),
          price: parseFloat(event.target.getAttribute('data-price')),
          image: event.target.getAttribute('data-image'),
        };
        this.addToCart(producto);
      }
    });

    this.dialog.addEventListener('click', (event) => {
      if (event.target === this.dialog) {
        this.dialog.close();
      }
    });
  }

  async renderCart() {
    this.cartContent.innerHTML = '';

    if (this.carrito.length === 0) {
      this.emptyMessage.style.display = 'block';
      this.cartTotal.textContent = '';
      return;
    }

    this.emptyMessage.style.display = 'none';

    this.carrito.forEach((producto, index) => {
      const item = document.createElement('div');
      item.classList.add('flex', 'justify-between', 'items-center', 'border-b', 'pb-2', 'mb-2');

      item.innerHTML = `
        <div class="flex items-center">
          <img src="${producto.image}" alt="${producto.title}" class="w-12 h-12 rounded mr-4">
          <div>
            <h3 class="text-sm font-bold">${producto.title}</h3>
            <p class="text-sm text-gray-600">${producto.description}</p>
          </div>
        </div>
        <div>
          <p class="text-sm font-bold">€${producto.price}</p>
          <button class="text-red-500 text-sm" data-id="${producto.id}">Eliminar</button>
        </div>
      `;

      item.querySelector('button').addEventListener('click', async () => {
        await this.removeFromCart(producto.id);
      });

      this.cartContent.appendChild(item);
    });

    const total = this.carrito.reduce((sum, item) => sum + item.price, 0);
    this.cartTotal.textContent = `Total: €${total}`;
  }

  async addToCart(producto) {
    if (!producto.title || !producto.price || !producto.image) {
      console.error('Producto inválido:', producto);
      return;
    }

    const exists = this.carrito.some(item => item.id === producto.id);
    if (exists) {
      console.warn(`El producto ya está en el carrito: ${producto.title}`);
      return;
    }

    this.carrito.push(producto);
    await addToIndexedDB(producto); // Guarda en IndexedDB
    this.updateCartCounter();// Actualiza el carrito
    this.renderCart();//Y vuelve a renderizar, estas dos últimas líneas se realiza tras todas las operaciones crud del carrito para manenerlo actualizado

    this.contadorCarrito.classList.add('animate-bounce');
    setTimeout(() => this.contadorCarrito.classList.remove('animate-bounce'), 500);
  }

  async removeFromCart(productId) {
    this.carrito = this.carrito.filter(item => item.id !== productId);
    await removeFromIndexedDB(productId); // Elimina de IndexedDB
    this.updateCartCounter();
    this.renderCart();
  }

  async emptyCart() {
    this.carrito = [];
    await clearIndexedDB(); // Vacia IndexedDB
    this.updateCartCounter();
    this.renderCart();
  }

  checkout() {
    alert('¡Gracias por tu compra!');
    this.emptyCart();
    this.dialog.close();
  }

  updateCartCounter() {
    this.contadorCarrito.textContent = this.carrito.length;
  }

  openCart() {//Abrimos el dialog del carrito
    this.dialog.showModal();
    this.renderCart();
  }
}
//He tenido que mover esta clase para inicializarla antes que el resto ya que luego si no estaba cargada antes que Productrender me daba problemas con el carrito
const shoppingCart = new ShoppingCart();

//Render de los productos en index en un grid
class CustomRender extends HTMLElement {
  constructor() {
    super();
    this.section = this.getAttribute('section') || ''; // Obtener el atributo `section` para filtrar los resultados que se renderizan en las páginas
  }

  connectedCallback() {
    this.style.display = 'contents'; // Hace que este elemento no interfiera con el layout
    this.fetchGames();
  }

  async fetchGames() {
    try {
      const response = await fetch('https://products-foniuhqsba-uc.a.run.app/Games');
      if (!response.ok) throw new Error('Error al obtener los juegos');

      const games = await response.json();

      // Filtrar por sección si está definida
      let filteredGames;
      if (this.section) {
        filteredGames = games.filter(function(game) {
          const platformsRaw = game.features[0] ? game.features[0].value : ''; //La plataforma por la que filtro están en features index 0 value
          const validPlatforms = platformsRaw
            .split(',')
            .map(function(platform) {
              return platform.trim().toLowerCase();
            })
            .filter(function(platform) {
              return ['ps', 'pc', 'xbox', 'nintendo', 'vr'].some(function(valid) {
                return platform.includes(valid);
              });
            });
          return validPlatforms.includes(this.section.toLowerCase());
        }, this); 
      } else {
        filteredGames = games;
      }

      this.render(filteredGames);
    } catch (error) {
      console.error('Error:', error);
      const gridContainer = this.parentElement;
      gridContainer.innerHTML += `<p class="text-red-500">Error al cargar los juegos. Inténtelo nuevamente más tarde.</p>`;
    }
  }


  render(games) {
    const template = document.querySelector('#product-template');
    const gridContainer = this.parentElement; // El contenedor del grid, asegurar que usa el grid como padre, esto es por los problemas que tuve de que me renderizaba mal el grid

    if (!gridContainer) {
      console.error('Grid container no encontrado.');
      return;
    }

    // Limpia cualquier contenido residual de custom-render
    this.innerHTML = '';

    games.forEach((game, index) => {
      const clone = template.content.cloneNode(true);
      clone.querySelector('#product-image').src = game.image;
      clone.querySelector('#product-fecha').textContent = game.date;
      const enlace = clone.querySelector('#product-title');
      enlace.textContent = game.title; // Establece el texto del enlace para que me lleve a mi página producto
      enlace.href = game.id ? `producto.html?id=${game.id}` : '#'; //Usa el id de cada juego para generarme un id en el html de producto
      clone.querySelector('#product-description').textContent = game.short_description;
      clone.querySelector('#product-price').textContent = game.price;
      clone.querySelector('#product-rating').textContent = `Rating: ${game.rating} ⭐`;
     
      // Formatea y filtra las plataformas 
      // Obtener las plataformas en formato crudo
      const platformsRaw = game.features[0] ? game.features[0].value : '';
      // Procesar las plataformas válidas
      const validPlatforms = platformsRaw
        .split(',')
        .map(function(platform) {
          return platform.trim().toLowerCase();
        })
        .filter(function(platform) {
          return ['ps', 'pc', 'xbox', 'nintendo', 'vr'].some(function(valid) {
            return platform.includes(valid);
          });
        });

      // Formatear las plataformas
      let platformsFormatted;
      if (validPlatforms.length > 0) {
        platformsFormatted = validPlatforms.join(', ').toUpperCase();
      } else {
        platformsFormatted = 'Plataforma no disponible';
      }
      clone.querySelector('#product-platforms').textContent = platformsFormatted;


      // Información adicional de renderizado para el popover de los juegos
      const popover = clone.querySelector('.info-popover');
      const uniquePopoverId = `info-popover-${game.id}`; // Crear un ID único basado en el ID del juego, si no lo añadía todo el rato me cargaba los datos del primer juego
      popover.id = uniquePopoverId;
  
      // Verifica que el popover está asignado correctamente
      console.log(`Asignando ID único al popover: ${popover.id}`);
      
      clone.querySelector('.popover-product-image').src = game.image;
      clone.querySelector('.popover-id').textContent = game.id;
      clone.querySelector('.popover-tags').textContent = game.tags?.join(', ') || 'N/A';
      clone.querySelector('.popover-fecha').textContent = game.date;
      clone.querySelector('.popover-edad').textContent = game.features[3]?.value || 'N/A';
      clone.querySelector('.popover-description').textContent = game.description || 'Sin descripción';

    // Configura el botón "Info" (popover)
    const infoButton = clone.querySelector('#info-anchor');
    infoButton.setAttribute('aria-controls', uniquePopoverId); // Asocia el botón al popover con un atributo accesible, al parecer que aria controls sirve para declarar explícitamente 
    //que un elemento (como un botón o un enlace) controla otro elemento en el DOM

    infoButton.addEventListener('click', (event) => {
      event.stopPropagation();

      // Obtiene el popover asociado al botón específico
      const popoverElement = document.getElementById(uniquePopoverId);

      if (popoverElement) {
        // Cierra todos los popovers abiertos antes de alternar
        document.querySelectorAll('.info-popover.visible').forEach(function(p) {
          p.classList.remove('visible');
        });
        // Alterna la visibilidad del popover actual
        popoverElement.classList.toggle('visible');
        console.log(`Toggling popover: ${uniquePopoverId}`);
          // Cierra al hacer scroll
        const closeOnScroll = () => {
          popoverElement.classList.remove('visible'); // Oculta el popover
          window.removeEventListener('scroll', closeOnScroll); // Elimina el evento una vez ejecutado
          console.log(`Popover ${uniquePopoverId} cerrado al hacer scroll`);
        };

        // Añade el evento para cerrar el popover al hacer scroll
        window.addEventListener('scroll', closeOnScroll);
      } else {
        console.error(`Popover con ID ${uniquePopoverId} no encontrado`);
      }
    });

    // Cierra los popovers al hacer clic fuera
    document.addEventListener('click', function(event) {
      // Asegura de que no se cierra un popover por un clic en el botón
      if (!event.target.closest('.info-anchor') && !event.target.closest('.info-popover')) {
        document.querySelectorAll('.info-popover.visible').forEach(function(p) {
          p.classList.remove('visible');
        });
      }
    });

    // Configurar el botón "Add to Cart"
    const addButton = clone.querySelector('#addCarrito');
    if (addButton) {
      // Asegura que el botón tenga los datos del producto
      addButton.addEventListener('click', () => {
        const product = {
          id: game.id,
          title: game.title,
          description: game.short_description,
          price: parseFloat(game.price), // Convertir a número
          image: game.image
        };
    
        console.log('Añadiendo producto al carrito:', product);
    
        // Llamada a addToCart en shoppingCart
        if (typeof shoppingCart !== 'undefined') {
          shoppingCart.addToCart(product);
        } else {
          console.error('shoppingCart no está definido.');
        }
      });
    }

      // Si es el primer elemento, agregar clases específicas para posición **Me estaba tratando el custom-render como un elemento y me dejaba un hueco vacío
      if (index === 0) {
        clone.firstElementChild.classList.add('col-start-1', 'row-start-1', 'col-span-1', 'row-span-1');
      }

      // Agregar el producto al contenedor del grid directamente
      gridContainer.appendChild(clone);
    });
  }
}
customElements.define('custom-render', CustomRender);

//Render de producto detalle
class ProductViewer extends HTMLElement {
  constructor() {
    super();
    this.apiUrl = 'https://products-foniuhqsba-uc.a.run.app/Games';
    this.id = this.getId(); 
  }

  connectedCallback() {
    this.renderProduct(); 
  }

  // Obtener el ID del producto desde la URL
  getId() {
    const searchParams = new URLSearchParams(location.search.slice(1));
    const id = Number(searchParams.get('id')); // Convertir a número
    console.log('ID obtenido:', id); // Verificar el ID
    return id;
  }


  async fetchProducts() {
    try {
      const response = await fetch(this.apiUrl);
      if (!response.ok) throw new Error('Error al obtener productos');
      const products = await response.json();
      console.log('Productos obtenidos:', products); // Verificar los productos
      return products;
    } catch (error) {
      console.error('Error al obtener los datos de la API:', error);
      return null;
    }
  }

  // Render de producto
  async renderProduct() {
    const products = await this.fetchProducts();
    if (!products) {
      this.innerHTML = `<p>Error al cargar los productos. Inténtelo más tarde.</p>`;
      return;
    }
    // Buscar el producto id
    //const product = products.find(p => p.id === this.id);
    const idToFind = String(this.id);
    const product = products.find(function(p) {
      return String(p.id) === idToFind;
    });
    

    if (!product) {
      this.innerHTML = `<p>Producto no encontrado.</p>`;
      return;
    }
    //Template
    const template = document.getElementById('product-template').content;
    const clone = document.importNode(template, true);
    clone.querySelector('#imagenJuego').src = product.image;
    clone.querySelector('#idJuego').textContent = product.id;
    clone.querySelector('#tituloJuego').textContent = product.title;
    clone.querySelector('#ratingJuego').textContent = `${product.rating}★`;
    clone.querySelector('#tagsJuego').textContent = product.tags.join(', ')  || 'Desconocido';
    clone.querySelector('#fechaJuego').textContent = product.date;
    clone.querySelector('#edadJuego').textContent = product.features[3].value || 'N/A';
    clone.querySelector('#precioJuego').textContent = product.price;
    clone.querySelector('#descripcionJuego').textContent = product.description;
    // Configurar el botón "Añadir al carrito"
    const addToCartButton = clone.querySelector('#addCarrito');
    if (!addToCartButton) {
      console.error('Botón Añadir al carrito no encontrado en el template.');
      return;
    }
    
    addToCartButton.addEventListener('click', () => {
      console.log('Evento click registrado en el botón Añadir al carrito');
      shoppingCart.addToCart({
        id: product.id,
        title: product.title,
        price: parseFloat(product.price),
        image: product.image,
        description: product.description,
        quantity: 1
      });
    
      alert('Producto añadido al carrito.');
    });
    this.appendChild(clone);
  }
}
customElements.define('custom-product', ProductViewer);

// Cambio de vista en el index del grid
document.getElementById('toggle-view').addEventListener('click', () => {
  const productList = document.getElementById('listaProductos'); // Selecciona el contenedor

  if (productList.classList.contains('grid')) {
    productList.classList.remove('grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3');
    productList.classList.add('flex', 'flex-col');
  } else {
    productList.classList.remove('flex', 'flex-col');
    productList.classList.add('grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3');
  }
});

//Filtrado de productos
//PENDIENTE DE HACER TODOS

//Filtro por checkbox lateral, al no ser elementos <a> de link hay que usar los eventos de cambio
document.getElementById('platform-pc').addEventListener('change', (event) => {
  if (event.target.checked) {
    window.location.href = 'pcgaming.html';
  }
});

document.getElementById('platform-nintendo').addEventListener('change', (event) => {
  if (event.target.checked) {
    window.location.href = 'nintendo.html';
  }
});

document.getElementById('platform-playstation').addEventListener('change', (event) => {
  if (event.target.checked) {
    window.location.href = 'playstation.html';
  }
});

document.getElementById('platform-xbox').addEventListener('change', (event) => {
  if (event.target.checked) {
    window.location.href = 'xbox.html';
  }
});

document.getElementById('platform-vr').addEventListener('change', (event) => {
  if (event.target.checked) {
    window.location.href = 'virtualreality.html';
  }
});

