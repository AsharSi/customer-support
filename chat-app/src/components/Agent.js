import AgentDashboard from "./AgentDashboard"
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function Agent() {

    const [user, setUser] = useState(null);

    const handleLogin = async (response) => {
        try {
            const res = await fetch('http://localhost:5000/api/auth/google', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token: response.credential }),
            });

            const data = await res.json();

            console.log(data);

            if (data.success) {
                setUser(data.user);
                toast.success('Login Success');
            } else {
                toast.error('Login Failed');
                console.log('Login Failed');
                setUser(null);

            }
        } catch (error) {
            setUser(null);
            toast.error("login failed");
            console.log(error);
        }
    }

    return (
        <>
            {
                user ?
                    <AgentDashboard email={user.email} />
                    :
                    <>
                        <GoogleLogin
                            onSuccess={credentialResponse => {
                                console.log(credentialResponse);
                                handleLogin(credentialResponse);
                            }}
                            onError={() => {
                                console.log('Login Failed');
                            }}
                        />

                        <button onClick={() => googleLogout()}>
                            Logout
                        </button>
                    </>
            }

            {/* <AgentDashboard email="ashutoshasharsimains@gmail.com" /> */}

        </>
    )
}