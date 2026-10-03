import { Link } from 'react-router-dom';
import { Empty } from '../../components/ui.jsx';

export default function NotFound() {
  return <Empty title="Esta página no existe" action={<Link to="/" className="btn btn-secondary">Ir al inicio</Link>} />;
}
