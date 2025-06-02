import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import './App.css';
import { auth, db, doc, getDoc, setDoc, updateDoc, increment } from './services/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, deleteDoc, getDocs, addDoc, query, orderBy, limit } from 'firebase/firestore';
import { FaWallet, FaSignOutAlt, FaGamepad, FaPlusCircle, FaUser } from 'react-icons/fa';
import { serverTimestamp } from 'firebase/firestore';
import ErrorBoundary from './components/ErrorBoundary';


function TopBar({ saldo, nome, onLogout }) {
  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <FaGamepad style={{marginRight:8}} />
        <Link to="/" className="top-link">Jogo</Link>
        <div className="top-divider" />
        <FaWallet style={{marginRight:6}} />
        <Link to="/carteira" className="top-link">Carteira</Link>
        <span className="saldo-carteira">R$ {saldo !== null ? saldo.toFixed(2) : '--'}</span>
      </div>
      <div className="top-bar-right">
        <Link to="/carregar" className="top-link"><FaPlusCircle style={{marginRight:6}} />Carregar</Link>
        <div className="top-divider" />
        <Link to="/perfil" className="top-link"><FaUser style={{marginRight:6}} />Perfil</Link>
        {nome && <span className="usuario-email">{nome}</span>}
        <button onClick={onLogout} className="top-link sair-btn" title="Sair"><FaSignOutAlt /></button>
      </div>
    </div>
  );
}

function Login({ setUser, setNome }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNomeInput] = useState('');
  const [novo, setNovo] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function traduzErro(err) {
    if (!err?.code) return 'Erro desconhecido.';
    if (err.code === 'auth/email-already-in-use') return 'Este e-mail já está cadastrado.';
    if (err.code === 'auth/invalid-email') return 'E-mail inválido.';
    if (err.code === 'auth/weak-password') return 'A senha deve ter pelo menos 6 caracteres.';
    if (err.code === 'auth/wrong-password') return 'Senha incorreta.';
    if (err.code === 'auth/user-not-found') return 'Usuário não encontrado.';
    return err.message;
  }

  async function handleLogin(e) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      let userCred;
      if (novo) {
        if (!nome.trim()) { setErro('Digite seu nome!'); setLoading(false); return; }
        userCred = await createUserWithEmailAndPassword(auth, email, senha);
        await setDoc(doc(db, 'usuarios', userCred.user.uid), { nome });
        await setDoc(doc(db, 'saldos', userCred.user.uid), { saldo: 0 });
      } else {
        userCred = await signInWithEmailAndPassword(auth, email, senha);
      }
      // Buscar nome SEMPRE após login/cadastro
      const snap = await getDoc(doc(db, 'usuarios', userCred.user.uid));
      setNome(snap.exists() ? snap.data().nome : '');
      setUser(userCred.user);
      setLoading(false);
      navigate('/');
    } catch (err) {
      setErro(traduzErro(err));
      setLoading(false);
    }
  }

  return (
    <div className="carregar-container">
      <h2>{novo ? 'Cadastro' : 'Login'}</h2>
      <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:12}}>
        <input type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input type="password" placeholder="Senha" value={senha} onChange={e=>setSenha(e.target.value)} required />
        {novo && <input type="text" placeholder="Nome" value={nome} onChange={e=>setNomeInput(e.target.value)} required maxLength={18} />}
        <button type="submit" disabled={loading}>{loading ? 'Entrando...' : (novo ? 'Cadastrar' : 'Entrar')}</button>
      </form>
      <button style={{marginTop:12}} onClick={()=>{setNovo(n=>!n); setErro('')}} disabled={loading}>
        {novo ? 'Já tem conta? Entrar' : 'Não tem conta? Cadastre-se'}
      </button>
      {erro && <div style={{color:'red',marginTop:8}}>{erro}</div>}
    </div>
  );
}

function Jogo({ saldo, setSaldo, user, nome }) {
  const [aposta, setAposta] = useState(2);
  const [selecionado, setSelecionado] = useState(null);
  const [apostas, setApostas] = useState([]); // {numero, nome, valor, uid}
  const [sorteado, setSorteado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [painel, setPainel] = useState([]); // histórico
  const [painelLoading, setPainelLoading] = useState(true);
  const valoresAposta = [2, 5, 10];
  const premios = { 2: 15, 5: 40, 10: 80 };

  // Nome da coleção da rifa conforme valor da aposta
  const rifaCollection = `rifa${aposta}`;

  // Buscar apostas em tempo real da rifa selecionada
  useEffect(() => {
    setSorteado(null);
    setSelecionado(null);
    const unsub = onSnapshot(collection(db, rifaCollection), snap => {
      const arr = [];
      snap.forEach(doc => arr.push(doc.data()));
      setApostas(arr);
    });
    return () => unsub();
  }, [rifaCollection]);

  // Buscar últimos 5 vencedores
  useEffect(() => {
    setPainelLoading(true);
    const q = query(collection(db, 'historicoRifas'), orderBy('timestamp', 'desc'), limit(5));
    const unsub = onSnapshot(q, snap => {
      const arr = [];
      snap.forEach(doc => arr.push(doc.data()));
      setPainel(arr);
      setPainelLoading(false);
    });
    return () => unsub();
  }, []);

  // Sorteio automático
  useEffect(() => {
    if (apostas.length === 9 && !sorteado) {
      const idx = Math.floor(Math.random() * 9);
      setTimeout(async () => {
        const vencedor = apostas[idx];
        setSorteado(vencedor);
        await setDoc(doc(db, 'saldos', vencedor.uid), { saldo: increment(premios[aposta]) }, { merge: true });
        // Salvar no histórico
        await addDoc(collection(db, 'historicoRifas'), {
          nome: vencedor.nome,
          valor: premios[aposta],
          aposta: aposta,
          numero: vencedor.numero + 1,
          timestamp: serverTimestamp()
        });
        // Após 4 segundos, resetar a rifa
        setTimeout(() => {
          resetarJogo();
        }, 4000);
      }, 800);
    }
    // eslint-disable-next-line
  }, [apostas, sorteado, aposta]);

  async function apostar() {
    if (!user) return alert('Faça login!');
    if (selecionado === null) return alert('Selecione um número!');
    if (saldo < aposta) return alert('Saldo insuficiente!');
    if (apostas.some(a => a.numero === selecionado)) return alert('Esse número já foi apostado!');
    if (sorteado) return; // não permite apostar durante painel do vencedor
    setLoading(true);
    // Verificação extra: tentar criar aposta, depois conferir se não foi concorrida
    const apostaRef = doc(db, rifaCollection, String(selecionado));
    const apostaSnap = await getDoc(apostaRef);
    if (apostaSnap.exists()) {
      setLoading(false);
      return alert('Esse número acabou de ser apostado por outro jogador!');
    }
    await setDoc(doc(db, 'saldos', user.uid), { saldo: increment(-aposta) }, { merge: true });
    await setDoc(apostaRef, {
      numero: selecionado,
      nome,
      valor: aposta,
      uid: user.uid
    });
    setSelecionado(null);
    setLoading(false);
  }

  async function resetarJogo() {
    setLoading(true);
    const snap = await getDocs(collection(db, rifaCollection));
    const batch = snap.docs.map(docu => deleteDoc(doc(db, rifaCollection, docu.id)));
    await Promise.all(batch);
    setApostas([]);
    setSorteado(null);
    setLoading(false);
  }

  function formatarHora(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  return (
    <div className="container">
      <div className="main-area">
        <div className="grid">
          {[...Array(9)].map((_, i) => {
            const apostaFeita = apostas.find(a => a.numero === i);
            return (
              <div
                key={i}
                className={`square${selecionado === i ? ' selected' : ''}${apostaFeita ? ' apostado' : ''}`}
                onClick={() => !apostaFeita && !sorteado && setSelecionado(i)}
                style={{ cursor: apostaFeita || sorteado ? 'not-allowed' : 'pointer' }}
              >
                <span className="numero-rifa">{i + 1}</span>
                {apostaFeita && (
                  <div className="nome-apostador">{apostaFeita.nome}</div>
                )}
              </div>
            );
          })}
        </div>
        {sorteado && (
          <div className="resultado-sorteio">
            <h2>Número sorteado: <span>{sorteado.numero + 1}</span></h2>
            <p>Vencedor: <b>{sorteado.nome}</b></p>
            <p>Prêmio: <b>R$ {premios[aposta]}</b></p>
            <p style={{color:'#888',marginTop:8}}>Nova rifa em instantes...</p>
          </div>
        )}
        <div className="painel-vencedores">
          <h3>Últimos vencedores</h3>
          {painelLoading ? <div>Carregando...</div> : (
            <table className="painel-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Prêmio</th>
                  <th>Aposta</th>
                  <th>Número</th>
                  <th>Horário</th>
                </tr>
              </thead>
              <tbody>
                {painel.map((v, idx) => (
                  <tr key={idx}>
                    <td>{v.nome}</td>
                    <td>R$ {v.valor}</td>
                    <td>R$ {v.aposta}</td>
                    <td>{v.numero}</td>
                    <td>{formatarHora(v.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className="side-bar">
        <h3>Valor da aposta</h3>
        {valoresAposta.map(v => (
          <button
            key={v}
            className={aposta === v ? 'aposta-btn selected' : 'aposta-btn'}
            onClick={() => { if (!sorteado) setAposta(v); }}
            disabled={!!sorteado || loading}
          >
            R$ {v}
          </button>
        ))}
        <div className="premio">Prêmio: R$ {premios[aposta]}</div>
        <button className="apostar-btn" onClick={apostar} disabled={!!sorteado || loading}>{loading ? 'Apostando...' : 'Apostar'}</button>
      </div>
    </div>
  );
}

function Carregar({ saldo, setSaldo, user }) {
  const [valor, setValor] = useState('');
  const navigate = useNavigate();

  async function carregar() {
    const v = parseFloat(valor);
    if (isNaN(v) || v <= 0) return alert('Digite um valor válido!');
    await setDoc(doc(db, 'saldos', user.uid), { saldo: increment(v) }, { merge: true });
    setValor('');
    navigate('/');
  }

  return (
    <div className="carregar-container">
      <h2>Carregar Saldo</h2>
      <input
        type="number"
        min="1"
        placeholder="Valor em reais"
        value={valor}
        onChange={e => setValor(e.target.value)}
      />
      <button onClick={carregar}>Carregar</button>
    </div>
  );
}

function NomeFallback({ user, setNome }) {
  const [novoNome, setNovoNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function salvarNome(e) {
    e.preventDefault();
    if (!novoNome.trim()) return setErro('Digite seu nome!');
    setLoading(true);
    try {
      await setDoc(doc(db, 'usuarios', user.uid), { nome: novoNome });
      setNome(novoNome);
      setLoading(false);
    } catch (err) {
      setErro('Erro ao salvar nome.');
      setLoading(false);
    }
  }

  return (
    <div className="carregar-container">
      <h2>Complete seu cadastro</h2>
      <form onSubmit={salvarNome} style={{display:'flex',flexDirection:'column',gap:12}}>
        <input type="text" placeholder="Seu nome" value={novoNome} onChange={e=>setNovoNome(e.target.value)} maxLength={18} required />
        <button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</button>
      </form>
      {erro && <div style={{color:'red',marginTop:8}}>{erro}</div>}
    </div>
  );
}

function Perfil({ user, nome, setNome }) {
  const [novoNome, setNovoNome] = useState(nome || '');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  async function salvarNome(e) {
    e.preventDefault();
    if (!novoNome.trim()) return setErro('Digite seu nome!');
    setLoading(true);
    setErro('');
    setSucesso('');
    try {
      await setDoc(doc(db, 'usuarios', user.uid), { nome: novoNome });
      setNome(novoNome);
      setSucesso('Nome atualizado com sucesso!');
      setLoading(false);
    } catch (err) {
      setErro('Erro ao salvar nome.');
      setLoading(false);
    }
  }

  return (
    <div className="carregar-container">
      <h2>Perfil</h2>
      <form onSubmit={salvarNome} style={{display:'flex',flexDirection:'column',gap:12}}>
        <input type="text" placeholder="Seu nome" value={novoNome} onChange={e=>setNovoNome(e.target.value)} maxLength={18} required />
        <button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</button>
      </form>
      {erro && <div style={{color:'red',marginTop:8}}>{erro}</div>}
      {sucesso && <div style={{color:'green',marginTop:8}}>{sucesso}</div>}
    </div>
  );
}

function Carteira({ saldo, user }) {
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    // Buscar histórico de transações do usuário
    const q = query(collection(db, 'historicoRifas'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const arr = [];
      snap.forEach(doc => {
        if (doc.data().nome && user && doc.data().nome === user.displayName) {
          arr.push(doc.data());
        }
      });
      setHistorico(arr);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  return (
    <div className="carregar-container">
      <h2>Carteira</h2>
      <div style={{marginBottom:16, fontWeight:'bold'}}>Saldo atual: <span style={{color:'#c9a13b'}}>R$ {saldo !== null ? saldo.toFixed(2) : '--'}</span></div>
      <h3 style={{marginTop:24}}>Histórico de Transações</h3>
      {loading ? <div>Carregando...</div> : (
        historico.length === 0 ? <div>Nenhuma transação encontrada.</div> :
        <table className="painel-table">
          <thead>
            <tr>
              <th>Prêmio</th>
              <th>Aposta</th>
              <th>Número</th>
              <th>Horário</th>
            </tr>
          </thead>
          <tbody>
            {historico.map((v, idx) => (
              <tr key={idx}>
                <td>R$ {v.valor}</td>
                <td>R$ {v.aposta}</td>
                <td>{v.numero}</td>
                <td>{v.timestamp && (v.timestamp.toDate ? v.timestamp.toDate().toLocaleString('pt-BR') : '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [saldo, setSaldo] = useState(null);
  const [nome, setNome] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let unsubSaldo = null;
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Escutar saldo em tempo real
        const ref = doc(db, 'saldos', u.uid);
        unsubSaldo = onSnapshot(ref, (snap) => {
          if (snap.exists()) setSaldo(snap.data().saldo);
        });
        // Busca nome SEMPRE após login
        const snapNome = await getDoc(doc(db, 'usuarios', u.uid));
        setNome(snapNome.exists() ? snapNome.data().nome : '');
      } else {
        setSaldo(null);
        setNome('');
        if (unsubSaldo) unsubSaldo();
      }
    });
    return () => { unsub(); if (unsubSaldo) unsubSaldo(); };
  }, []);

  async function handleLogout() {
    await signOut(auth);
    setUser(null);
    setSaldo(null);
    setNome('');
    navigate('/login');
  }

  return (
    <div>
      <TopBar saldo={saldo} nome={nome} onLogout={handleLogout} />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login setUser={setUser} setNome={setNome} />} />
        <Route path="/" element={user ? (nome ? <Jogo saldo={saldo} setSaldo={setSaldo} user={user} nome={nome} /> : <NomeFallback user={user} setNome={setNome} />) : <Navigate to="/login" />} />
        <Route path="/carregar" element={user ? (nome ? <Carregar saldo={saldo} setSaldo={setSaldo} user={user} /> : <NomeFallback user={user} setNome={setNome} />) : <Navigate to="/login" />} />
        <Route path="/perfil" element={user ? <Perfil user={user} nome={nome} setNome={setNome} /> : <Navigate to="/login" />} />
        <Route path="/carteira" element={user ? <Carteira saldo={saldo} user={user} /> : <Navigate to="/login" />} />
      </Routes>
    </div>
  );
}

export default App;
